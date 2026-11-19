-- Phase 2 / batch 1: additive only (no drops, no data deletes).
-- duplicate check, in-app notifications, partner<->admin chat, courier documents,
-- company logo uploads, referral links + public join page, fraud signals.

-- ---------------------------------------------------------------- 1. instant duplicate check
create or replace function public.check_courier_mobile(p_mobile text)
returns text language plpgsql stable security definer set search_path = public as $$
declare v text := public.norm_mobile(p_mobile); fid uuid := public.my_freelancer_id(); v_owner uuid;
begin
  if fid is null then raise exception 'not_freelancer'; end if;
  if length(coalesce(v, '')) < 9 then return 'invalid'; end if;
  select freelancer_id into v_owner from public.candidates where mobile = v and status <> 'rejected' limit 1;
  if v_owner is null then return 'free'; end if;
  return case when v_owner = fid then 'mine' else 'taken' end;
end $$;
revoke all on function public.check_courier_mobile(text) from public, anon;
grant execute on function public.check_courier_mobile(text) to authenticated;

-- ---------------------------------------------------------------- 2. in-app notifications
create or replace function public.fmt_amount(p numeric)
returns text language sql immutable as $$
  select case when p = trunc(p) then to_char(p, 'FM999,999,990') else to_char(p, 'FM999,999,990.00') end
$$;
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  freelancer_id uuid not null references public.freelancers(id),
  kind text not null,
  title text not null,
  body text,
  link text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_fl_idx on public.notifications (freelancer_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications for select to authenticated
  using (freelancer_id = public.my_freelancer_id());

create or replace function public.mark_notifications_read()
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now() where freelancer_id = public.my_freelancer_id() and read_at is null;
$$;
revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

create or replace function public.notify(p_fl uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (freelancer_id, kind, title, body, link) values (p_fl, p_kind, p_title, p_body, p_link);
exception when others then null; -- a notification must never block the real change
end $$;
revoke all on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function public.notify_candidate_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'hired' then
      perform public.notify(new.freelancer_id, 'hired', '🎉 ' || new.name || ' اتعيّن', 'مندوبك اتعيّن وبدأ مشواره، وبونص الأيام هيبدأ يتحسب.', 'couriers');
    elsif new.status = 'rejected' then
      perform public.notify(new.freelancer_id, 'rejected', new.name || ' اترفض', coalesce(nullif(new.admin_note, ''), 'كلّم الإدارة لو محتاج تفاصيل.'), 'couriers');
    elsif new.status = 'new' then
      perform public.notify(new.freelancer_id, 'accepted', '✅ ' || new.name || ' اتقبل كمرشح', 'الإدارة راجعت الترشيح وقبلته.', 'couriers');
    end if;
  end if;
  if new.paper_date is not null and old.paper_date is null then
    perform public.notify(new.freelancer_id, 'paper', '📄 ' || new.name || ' خلّص ورقه', 'بونص الورق اتضاف لمحفظتك.', 'wallet');
  end if;
  return new;
end $$;
drop trigger if exists candidates_notify on public.candidates;
create trigger candidates_notify after update on public.candidates
  for each row execute function public.notify_candidate_change();

create or replace function public.notify_ledger_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.amount > 0 and new.freelancer_id is not null then
    perform public.notify(new.freelancer_id, 'bonus', '💰 بونص جديد +' || public.fmt_amount(new.amount) || ' ج',
      case new.kind when 'paper' then 'بونص ورق' when 'days' then 'بونص ' || new.tier_days || ' يوم شغل' else coalesce(new.note, 'تسوية من الإدارة') end, 'wallet');
  end if;
  return new;
end $$;
drop trigger if exists ledger_notify on public.bonus_ledger;
create trigger ledger_notify after insert on public.bonus_ledger
  for each row execute function public.notify_ledger_insert();

create or replace function public.notify_withdrawal_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'paid' then
      perform public.notify(new.freelancer_id, 'paid', '💸 فلوسك اتحوّلت', public.fmt_amount(new.amount) || ' ج على ' || new.method, 'wallet');
    elsif new.status = 'rejected' then
      perform public.notify(new.freelancer_id, 'wd_rejected', 'طلب السحب اترفض', coalesce(nullif(new.admin_note, ''), 'كلّم الإدارة لو محتاج تفاصيل.'), 'wallet');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists withdrawals_notify on public.withdrawals;
create trigger withdrawals_notify after update on public.withdrawals
  for each row execute function public.notify_withdrawal_change();

-- ---------------------------------------------------------------- 3. partner <-> admin chat
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  freelancer_id uuid not null references public.freelancers(id),
  from_staff boolean not null default false,
  staff_id uuid,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_fl_idx on public.messages (freelancer_id, created_at);
alter table public.messages enable row level security;
drop policy if exists msg_select on public.messages;
create policy msg_select on public.messages for select to authenticated
  using (freelancer_id = public.my_freelancer_id() or public.has_perm('partners'));

create or replace function public.send_message(p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare fid uuid := public.my_freelancer_id(); v bigint;
begin
  if fid is null then raise exception 'not_freelancer'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'invalid_input'; end if;
  if (select count(*) from public.messages where freelancer_id = fid and not from_staff and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited';
  end if;
  insert into public.messages (freelancer_id, body) values (fid, left(trim(p_body), 2000)) returning id into v;
  return v;
end $$;

create or replace function public.admin_send_message(p_freelancer uuid, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  if not public.has_perm('partners') then raise exception 'not_allowed'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'invalid_input'; end if;
  insert into public.messages (freelancer_id, from_staff, staff_id, body) values (p_freelancer, true, auth.uid(), left(trim(p_body), 2000)) returning id into v;
  perform public.notify(p_freelancer, 'message', '💬 رسالة من الإدارة', left(trim(p_body), 140), 'chat');
  return v;
end $$;

create or replace function public.mark_messages_read(p_freelancer uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_freelancer is null then
    update public.messages set read_at = now() where freelancer_id = public.my_freelancer_id() and from_staff and read_at is null;
  elsif public.has_perm('partners') then
    update public.messages set read_at = now() where freelancer_id = p_freelancer and not from_staff and read_at is null;
  end if;
end $$;
revoke all on function public.send_message(text) from public, anon;
revoke all on function public.admin_send_message(uuid, text) from public, anon;
revoke all on function public.mark_messages_read(uuid) from public, anon;
grant execute on function public.send_message(text), public.admin_send_message(uuid, text), public.mark_messages_read(uuid) to authenticated;

-- ---------------------------------------------------------------- 4. storage: courier documents (private) + company logos (public)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('courier-docs', 'courier-docs', false, 6291456, array['image/jpeg','image/png','image/webp','image/heic','application/pdf']),
       ('company-logos', 'company-logos', true, 1048576, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do nothing;

-- path: <freelancer_id>/<candidate_id>/<file>
drop policy if exists docs_insert on storage.objects;
create policy docs_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'courier-docs'
  and (storage.foldername(name))[1] = public.my_freelancer_id()::text
  and exists (select 1 from public.candidates c where c.id::text = (storage.foldername(name))[2] and c.freelancer_id = public.my_freelancer_id())
);
drop policy if exists docs_select on storage.objects;
create policy docs_select on storage.objects for select to authenticated using (
  bucket_id = 'courier-docs'
  and ((storage.foldername(name))[1] = public.my_freelancer_id()::text or public.has_perm('couriers'))
);
drop policy if exists logos_insert on storage.objects;
create policy logos_insert on storage.objects for insert to authenticated with check (bucket_id = 'company-logos' and public.has_perm('companies'));
drop policy if exists logos_update on storage.objects;
create policy logos_update on storage.objects for update to authenticated using (bucket_id = 'company-logos' and public.has_perm('companies'));

-- ---------------------------------------------------------------- 6. referral links + public join page
alter table public.freelancers add column if not exists ref_code text;
update public.freelancers set ref_code = lower(substr(md5(id::text || clock_timestamp()::text), 1, 7)) where ref_code is null;
alter table public.freelancers alter column ref_code set default lower(substr(md5(gen_random_uuid()::text), 1, 7));
create unique index if not exists freelancers_ref_code_key on public.freelancers (ref_code);
alter table public.candidates add column if not exists source text not null default 'partner';

create or replace function public.public_ref_info(p_ref text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f record;
begin
  select id, split_part(name, ' ', 1) as first_name into f from public.freelancers
   where ref_code = lower(trim(p_ref)) and status = 'Active' and duplicate_of is null;
  if not found then return null; end if;
  return jsonb_build_object('partner', f.first_name,
    'jobs', coalesce((select jsonb_agg(jsonb_build_object('id', j.id, 'title', j.title, 'company', coalesce(c.name, j.company_name),
              'logo_url', c.logo_url, 'gov', j.gov, 'region', j.region, 'vehicle', j.vehicle, 'work_type', j.work_type, 'pricing', j.pricing)
              order by j.created_at desc)
       from public.jobs j left join public.companies c on c.id = j.company_id
      where j.status = 'Active' and (j.expiry is null or j.expiry >= current_date)
        and (j.headcount is null or (select count(*) from public.candidates x where x.job_id = j.id and x.status <> 'rejected') < j.headcount)), '[]'::jsonb));
end $$;

create or replace function public.public_join(p_ref text, p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare fid uuid; v_mobile text; v_job record;
begin
  select id into fid from public.freelancers where ref_code = lower(trim(p_ref)) and status = 'Active' and duplicate_of is null;
  if fid is null then raise exception 'invalid_ref'; end if;
  v_mobile := public.norm_mobile(p->>'mobile');
  if coalesce(trim(p->>'name'), '') = '' or coalesce(v_mobile, '') !~ '^1[0125][0-9]{8}$' then raise exception 'invalid_input'; end if;
  if (select count(*) from public.candidates where freelancer_id = fid and source = 'self' and created_at > now() - interval '1 day') >= 30
     or (select count(*) from public.candidates where source = 'self' and created_at > now() - interval '1 hour') >= 100 then
    raise exception 'rate_limited';
  end if;
  perform pg_advisory_xact_lock(hashtext('cand:' || v_mobile));
  if exists (select 1 from public.candidates where mobile = v_mobile and status <> 'rejected') then raise exception 'courier_exists'; end if;
  select * into v_job from public.jobs where id = nullif(p->>'job_id', '')::uuid and status = 'Active' and (expiry is null or expiry >= current_date);
  if not found then raise exception 'job_closed'; end if;
  if v_job.headcount is not null and (select count(*) from public.candidates where job_id = v_job.id and status <> 'rejected') >= v_job.headcount then
    raise exception 'job_full';
  end if;
  insert into public.candidates (freelancer_id, company_id, job_id, name, mobile, mobile_raw, gov, region, vehicle, source)
  values (fid, v_job.company_id, v_job.id, left(trim(p->>'name'), 120), v_mobile, left(trim(p->>'mobile'), 30),
          left(trim(coalesce(p->>'gov', v_job.gov, '')), 100), left(trim(coalesce(p->>'region', '')), 100),
          left(trim(coalesce(p->>'vehicle', v_job.vehicle, '')), 60), 'self');
  perform public.notify(fid, 'self_join', '🙌 مندوب سجّل من لينكك', left(trim(p->>'name'), 60) || ' سجّل على ' || v_job.title, 'couriers');
  return 'ok';
end $$;
revoke all on function public.public_ref_info(text) from public;
grant execute on function public.public_ref_info(text) to anon, authenticated;
-- public_join is only callable by the `join` edge function (service role), which checks Cloudflare Turnstile first.
revoke all on function public.public_join(text, jsonb) from public, anon, authenticated;
grant execute on function public.public_join(text, jsonb) to service_role;

-- my_summary: also return ref_code and unread counts (same shape otherwise)
create or replace function public.my_summary()
returns jsonb language plpgsql security definer set search_path = public as $$
declare f record; b record;
begin
  select * into f from public.freelancers where user_id = auth.uid() and duplicate_of is null;
  if not found then return jsonb_build_object('freelancer', null); end if;
  if f.status = 'Active' then perform public.accrue_freelancer(f.id); end if;
  select * into b from public.freelancer_balances where freelancer_id = f.id;
  return jsonb_build_object(
    'freelancer', jsonb_build_object('id', f.id, 'name', f.name, 'mobile', f.mobile, 'email', f.email,
                                     'gov', f.gov, 'region', f.region, 'status', f.status, 'created_at', f.created_at,
                                     'ref_code', f.ref_code),
    'balance', to_jsonb(b),
    'counts', (select jsonb_build_object(
                 'total', count(*),
                 'hired', count(*) filter (where status = 'hired'),
                 'pending', count(*) filter (where status in ('submitted','new')),
                 'rejected', count(*) filter (where status = 'rejected'))
               from public.candidates where freelancer_id = f.id),
    'unread', jsonb_build_object(
                 'notifications', (select count(*) from public.notifications where freelancer_id = f.id and read_at is null),
                 'messages', (select count(*) from public.messages where freelancer_id = f.id and from_staff and read_at is null)));
end $$;

-- ---------------------------------------------------------------- 7. fraud / quality signals for admins
create or replace function public.admin_fraud_signals()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm('partners') then raise exception 'not_allowed'; end if;
  return jsonb_build_object(
    'self_nominated', coalesce((select jsonb_agg(jsonb_build_object('freelancer', f.name, 'freelancer_id', f.id, 'courier', c.name, 'code', c.code))
        from public.candidates c join public.freelancers f on f.id = c.freelancer_id where c.mobile = f.mobile), '[]'::jsonb),
    'bursts', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('freelancer', f.name, 'freelancer_id', f.id, 'count', count(*), 'day', date(c.created_at)) x
          from public.candidates c join public.freelancers f on f.id = c.freelancer_id
         where c.created_at > now() - interval '30 days'
         group by f.id, f.name, date(c.created_at) having count(*) >= 10) s), '[]'::jsonb),
    'quick_quits', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('freelancer', f.name, 'freelancer_id', f.id,
                 'started', count(*) filter (where c.start_date is not null),
                 'quit_within_7', count(*) filter (where c.end_date is not null and c.end_date - c.start_date < 7)) x
          from public.candidates c join public.freelancers f on f.id = c.freelancer_id
         group by f.id, f.name
        having count(*) filter (where c.end_date is not null and c.end_date - c.start_date < 7) >= 3) s), '[]'::jsonb),
    'stale_submissions', (select count(*) from public.candidates where status = 'submitted' and created_at < now() - interval '48 hours')
  );
end $$;
revoke all on function public.admin_fraud_signals() from public, anon;
grant execute on function public.admin_fraud_signals() to authenticated;

-- hardening (applied as phase2_batch1_hardening)
alter function public.fmt_amount(numeric) set search_path = public;
revoke all on function public.notify_candidate_change() from public, anon, authenticated;
revoke all on function public.notify_ledger_insert() from public, anon, authenticated;
revoke all on function public.notify_withdrawal_change() from public, anon, authenticated;
