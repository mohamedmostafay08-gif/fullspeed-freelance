-- Security hardening from the 23 Nov 2026 audit. Additive / tightening only; no data is deleted.

-- 1. Settings: partners and the public only see the keys the apps actually render.
drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings for select to anon, authenticated
  using (key in ('announcement', 'features', 'levels', 'job_broadcast') or public.has_perm('view'));

-- 2. Levels are rendered by every partner app: accept only a clean shape (plain names, hex colours).
create or replace function public.admin_set_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare lv jsonb;
begin
  if not public.has_perm('settings') then raise exception 'not_allowed'; end if;
  if p_key not in ('announcement','features','levels','job_broadcast','automation') then raise exception 'invalid_input'; end if;
  if p_key = 'levels' then
    if jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) = 0 or jsonb_array_length(p_value) > 12 then raise exception 'invalid_input'; end if;
    for lv in select * from jsonb_array_elements(p_value) loop
      if coalesce(lv->>'n', '') ~ '[<>&"''`]' or length(coalesce(lv->>'n', '')) > 24
         or coalesce(lv->>'i', '') ~ '[<>&"''`]' or length(coalesce(lv->>'i', '')) > 8
         or coalesce(lv->>'c', '#000') !~* '^#[0-9a-f]{3,8}$'
         or (lv->>'min') is null or (lv->>'min') !~ '^[0-9]+$' then
        raise exception 'invalid_input';
      end if;
    end loop;
  end if;
  insert into public.app_settings (key, value, updated_at, updated_by) values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
end $$;
revoke all on function public.admin_set_setting(text, jsonb) from public, anon;
grant execute on function public.admin_set_setting(text, jsonb) to authenticated;

-- 3. Campaigns pay money: creating or changing one needs the finance permission as well as companies.
drop policy if exists campaigns_ins on public.bonus_campaigns;
create policy campaigns_ins on public.bonus_campaigns for insert to authenticated
  with check (public.has_perm('companies') and public.has_perm('withdrawals'));
drop policy if exists campaigns_upd on public.bonus_campaigns;
create policy campaigns_upd on public.bonus_campaigns for update to authenticated
  using (public.has_perm('companies') and public.has_perm('withdrawals'))
  with check (public.has_perm('companies') and public.has_perm('withdrawals'));

-- 4. Back-dating work dates releases bonus tiers at once: dates more than 14 days in the past need the owner.
create or replace function public.guard_backdated_dates()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim date := (now() at time zone 'Africa/Cairo')::date - 14;
begin
  if public.my_staff_role() = 'owner' or auth.uid() is null then return new; end if;  -- owner, cron and service jobs
  if (new.start_date is distinct from old.start_date and new.start_date < lim)
     or (new.paper_date is distinct from old.paper_date and new.paper_date < lim) then
    raise exception 'backdate_needs_owner';
  end if;
  return new;
end $$;
revoke all on function public.guard_backdated_dates() from public, anon, authenticated;
drop trigger if exists candidates_guard_backdate on public.candidates;
create trigger candidates_guard_backdate before update of start_date, paper_date on public.candidates
  for each row execute function public.guard_backdated_dates();

-- 5. Company logos: no SVG (it can carry script when opened directly).
update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'company-logos';

-- 6. Courier documents: partners can remove their own uploads; staff with couriers can remove any.
drop policy if exists docs_delete on storage.objects;
create policy docs_delete on storage.objects for delete to authenticated using (
  bucket_id = 'courier-docs'
  and ((storage.foldername(name))[1] = public.my_freelancer_id()::text or public.has_perm('couriers'))
);

-- 7. Every other admin_* function is closed to anonymous callers; close this one too.
do $$ declare r record; begin
  for r in select p.oid::regprocedure as sig from pg_proc p where p.proname = 'admin_save_company' and p.pronamespace = 'public'::regnamespace loop
    execute format('revoke all on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

-- 8. Staff that are deactivated stop receiving staff pushes.
delete from public.staff_push_subscriptions s
 where not exists (select 1 from public.staff t where t.user_id = s.user_id and t.active);
