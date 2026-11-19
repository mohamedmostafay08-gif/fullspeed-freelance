-- Phase 7 (task #21): automation rules (hourly) + withdrawal transfer receipts.
-- Additive only: new table, new column, new bucket, new functions, new cron job.

-- ---------------------------------------------------------------- 1. automation config + log
insert into public.app_settings (key, value) values
  ('automation', '{"close_jobs": true, "stall_on": true, "stall_days": 5, "stall_statuses": ["new","submitted"], "stale_days": 3}'::jsonb)
on conflict (key) do nothing;

-- allow staff with the settings permission to save the new key (keeps the existing whitelist)
create or replace function public.admin_set_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('settings') then raise exception 'not_allowed'; end if;
  if p_key not in ('announcement','features','levels','job_broadcast','automation') then raise exception 'invalid_input'; end if;
  insert into public.app_settings (key, value, updated_at, updated_by) values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
end $$;
revoke all on function public.admin_set_setting(text, jsonb) from public, anon;
grant execute on function public.admin_set_setting(text, jsonb) to authenticated;

-- Append-only system log of what the automation did (it is itself the audit trail of the rules;
-- the rows it changes — jobs — keep their own audit trigger).
create table if not exists public.automation_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  action text not null,          -- run | job_closed | stall_reminder
  ref uuid,                      -- job id / candidate id
  detail jsonb
);
create index if not exists automation_log_at_idx on public.automation_log (at desc);
create index if not exists automation_log_ref_idx on public.automation_log (action, ref, at desc);
alter table public.automation_log enable row level security;
revoke all on public.automation_log from anon, authenticated;
grant select on public.automation_log to authenticated;
grant all on public.automation_log to service_role;
drop policy if exists automation_log_select on public.automation_log;
create policy automation_log_select on public.automation_log for select to authenticated
  using (public.has_perm('settings') or public.has_perm('view'));

create or replace function public.automation_cfg()
returns jsonb language sql stable security definer set search_path = public as $$
  select '{"close_jobs": true, "stall_on": true, "stall_days": 5, "stall_statuses": ["new","submitted"], "stale_days": 3}'::jsonb
         || coalesce((select value from public.app_settings where key = 'automation'), '{}'::jsonb)
$$;
revoke all on function public.automation_cfg() from public, anon;
grant execute on function public.automation_cfg() to authenticated, service_role;

-- One idempotent pass over every rule. Safe to run any time.
create or replace function public.run_automation(p_manual boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb := public.automation_cfg();
  v_days int := greatest(1, least(60, coalesce((cfg->>'stall_days')::int, 5)));
  v_stale int := greatest(1, least(60, coalesce((cfg->>'stale_days')::int, 3)));
  v_sts text[] := coalesce(array(select jsonb_array_elements_text(cfg->'stall_statuses')), array['new','submitted']);
  v_closed int := 0; v_reminded int := 0; v_stale_n int; r record;
begin
  -- 1) close jobs that expired or reached their headcount.
  --    A job the automation closed once is never auto-closed again, so staff can re-open it on purpose.
  if coalesce((cfg->>'close_jobs')::boolean, true) then
    for r in
      select j.id, j.code, j.headcount, j.expiry,
             (select count(*) from public.candidates c where c.job_id = j.id and c.status = 'hired') as hired
        from public.jobs j
       where j.status = 'Active'
         and not exists (select 1 from public.automation_log l where l.action = 'job_closed' and l.ref = j.id)
    loop
      if (r.expiry is not null and r.expiry < current_date) or (r.headcount is not null and r.hired >= r.headcount) then
        update public.jobs set status = 'Inactive' where id = r.id and status = 'Active';
        insert into public.automation_log (action, ref, detail) values ('job_closed', r.id,
          jsonb_build_object('code', r.code, 'why', case when r.expiry is not null and r.expiry < current_date then 'expired' else 'full' end,
                             'hired', r.hired, 'headcount', r.headcount, 'expiry', r.expiry));
        v_closed := v_closed + 1;
      end if;
    end loop;
  end if;

  -- 2) remind the partner about couriers that have not moved for N days (max once per courier per N days).
  if coalesce((cfg->>'stall_on')::boolean, true) then
    for r in
      select c.id, c.freelancer_id, c.name, c.status, c.updated_at
        from public.candidates c
        join public.freelancers f on f.id = c.freelancer_id and f.status = 'Active'
       where c.status = any(v_sts)
         and c.updated_at < now() - make_interval(days => v_days)
         and not exists (select 1 from public.automation_log l
                          where l.action = 'stall_reminder' and l.ref = c.id and l.at > now() - make_interval(days => v_days))
       limit 500
    loop
      perform public.notify(r.freelancer_id, 'stalled',
        case when r.status = 'submitted' then '⏳ ترشيح ' || r.name || ' لسه تحت المراجعة'
             else '👀 تابع مع ' || r.name end,
        case when r.status = 'submitted' then 'بقاله ' || (current_date - r.updated_at::date) || ' يوم. اتأكد إن رقمه صح وإنه مستعد، وكلّم الإدارة لو محتاج.'
             else 'بقاله ' || (current_date - r.updated_at::date) || ' يوم من غير تقدّم. كلّمه يخلّص الورق ويبدأ شغل عشان البونص.' end,
        'couriers');
      insert into public.automation_log (action, ref, detail)
        values ('stall_reminder', r.id, jsonb_build_object('name', r.name, 'status', r.status, 'freelancer_id', r.freelancer_id,
                                                           'days', current_date - r.updated_at::date));
      v_reminded := v_reminded + 1;
    end loop;
  end if;

  -- 3) submissions waiting for staff review longer than the threshold (reported, not changed).
  select count(*) into v_stale_n from public.candidates
   where status = 'submitted' and created_at < now() - make_interval(days => v_stale);

  insert into public.automation_log (action, detail) values ('run',
    jsonb_build_object('closed', v_closed, 'reminded', v_reminded, 'stale', v_stale_n, 'manual', p_manual,
                       'by', case when p_manual then (select email from public.staff where user_id = auth.uid()) end));
  return jsonb_build_object('closed', v_closed, 'reminded', v_reminded, 'stale', v_stale_n);
end $$;
revoke all on function public.run_automation(boolean) from public, anon, authenticated;
grant execute on function public.run_automation(boolean) to service_role;

-- "Run now" button in Settings
create or replace function public.admin_run_automation()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('settings') then raise exception 'not_allowed'; end if;
  return public.run_automation(true);
end $$;
revoke all on function public.admin_run_automation() from public, anon;
grant execute on function public.admin_run_automation() to authenticated;

-- stale count for the admin badge (uses the configured threshold)
create or replace function public.admin_stale_count()
returns integer language sql stable security definer set search_path = public as $$
  select case when public.has_perm('view') then
    (select count(*)::int from public.candidates
      where status = 'submitted'
        and created_at < now() - make_interval(days => greatest(1, coalesce((public.automation_cfg()->>'stale_days')::int, 3))))
  else 0 end
$$;
revoke all on function public.admin_stale_count() from public, anon;
grant execute on function public.admin_stale_count() to authenticated;

-- daily report: "stale" now follows the configured threshold (same keys as before)
create or replace function public.daily_report_data()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'new_candidates', (select count(*) from public.candidates where created_at > now() - interval '24 hours'),
    'self_joins', (select count(*) from public.candidates where source = 'self' and created_at > now() - interval '24 hours'),
    'started', (select count(*) from public.candidates where start_date >= current_date - 1),
    'stale', (select count(*) from public.candidates where status = 'submitted'
                and created_at < now() - make_interval(days => greatest(1, coalesce((public.automation_cfg()->>'stale_days')::int, 3)))),
    'wd_pending', (select count(*) from public.withdrawals where status = 'pending'),
    'wd_amount', (select coalesce(sum(amount), 0) from public.withdrawals where status = 'pending'),
    'unread_msgs', (select count(*) from public.messages where not from_staff and read_at is null),
    'pending_partners', (select count(*) from public.freelancers where status = 'Pending' and duplicate_of is null),
    'errors', (select count(*) from public.client_errors where at > now() - interval '24 hours'));
$$;
revoke all on function public.daily_report_data() from public, anon, authenticated;
grant execute on function public.daily_report_data() to service_role;

-- hourly, at minute 17
select cron.unschedule('fsf-automation') where exists (select 1 from cron.job where jobname = 'fsf-automation');
select cron.schedule('fsf-automation', '17 * * * *', $cron$ select public.run_automation(false) $cron$);

-- ---------------------------------------------------------------- 2. withdrawal transfer receipts
alter table public.withdrawals add column if not exists receipt_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

-- path: <freelancer_id>/<withdrawal_id>.<ext>
drop policy if exists receipts_insert on storage.objects;
create policy receipts_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'receipts' and public.has_perm('withdrawals'));
drop policy if exists receipts_update on storage.objects;
create policy receipts_update on storage.objects for update to authenticated using (
  bucket_id = 'receipts' and public.has_perm('withdrawals'));
drop policy if exists receipts_select on storage.objects;
create policy receipts_select on storage.objects for select to authenticated using (
  bucket_id = 'receipts'
  and ((storage.foldername(name))[1] = public.my_freelancer_id()::text or public.has_perm('withdrawals')));

create or replace function public.admin_set_withdrawal_receipt(p_id uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare w record;
begin
  if not public.has_perm('withdrawals') then raise exception 'not_allowed'; end if;
  select * into w from public.withdrawals where id = p_id;
  if not found then raise exception 'not_found'; end if;
  if w.status <> 'paid' then raise exception 'invalid_input'; end if;
  if p_path is null or p_path !~ ('^' || w.freelancer_id::text || '/' || w.id::text || '\.(jpg|jpeg|png|webp|heic|pdf)$') then
    raise exception 'invalid_input';
  end if;
  update public.withdrawals set receipt_path = p_path where id = p_id;
  -- Tell the partner only when the receipt arrives after the "paid" notification.
  if w.decided_at < now() - interval '2 minutes' and w.receipt_path is distinct from p_path then
    perform public.notify(w.freelancer_id, 'paid', '🧾 إيصال التحويل وصل', 'إيصال تحويل ' || public.fmt_amount(w.amount) || ' ج موجود في المحفظة.', 'wallet');
  end if;
end $$;
revoke all on function public.admin_set_withdrawal_receipt(uuid, text) from public, anon;
grant execute on function public.admin_set_withdrawal_receipt(uuid, text) to authenticated;
