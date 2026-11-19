-- Phase 7: staff passkeys (shared passkeys table), staff login history, weekly report push.

-- ---------------------------------------------------------------- staff login history
create table if not exists public.staff_logins (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  email text,
  at timestamptz not null default now(),
  method text not null default 'password' check (method in ('password', 'passkey', 'session')),
  device_hash text not null,
  device text,
  ua text,
  ip text,
  new_device boolean not null default false
);
create index if not exists staff_logins_user_idx on public.staff_logins (user_id, at desc);
create index if not exists staff_logins_dev_idx on public.staff_logins (user_id, device_hash);
alter table public.staff_logins enable row level security;
revoke all on public.staff_logins from anon, authenticated;
grant select on public.staff_logins to authenticated;
grant all on public.staff_logins to service_role;
drop policy if exists staff_logins_read on public.staff_logins;
-- each staff member sees their own logins; owners see everyone's. Rows are written only by the passkey edge function.
create policy staff_logins_read on public.staff_logins for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.staff s where s.user_id = auth.uid() and s.active and s.role = 'owner')
);

-- ---------------------------------------------------------------- rename own passkey (partners + staff)
create or replace function public.rename_my_passkey(p_id text, p_name text)
returns void language sql security definer set search_path = public as $$
  update public.passkeys set device = nullif(left(trim(p_name), 80), '') where id = p_id and user_id = auth.uid();
$$;
revoke all on function public.rename_my_passkey(text, text) from public, anon;
grant execute on function public.rename_my_passkey(text, text) to authenticated;

-- ---------------------------------------------------------------- weekly report numbers (service role only, for the push text)
-- Week = Saturday..Friday, Egypt time. Returns the last complete week and the one before it.
create or replace function public.weekly_report_data()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Africa/Cairo')::date;
  back int := ((extract(dow from today)::int - 5 + 7) % 7);
  w_end date; w_start date; p_start date; p_end date;
  r jsonb;
begin
  if back = 0 then back := 7; end if;
  w_end := today - back; w_start := w_end - 6; p_end := w_start - 1; p_start := p_end - 6;
  select jsonb_build_object(
    'from', w_start, 'to', w_end,
    'nominations', (select count(*) from candidates where (created_at at time zone 'Africa/Cairo')::date between w_start and w_end),
    'nominations_prev', (select count(*) from candidates where (created_at at time zone 'Africa/Cairo')::date between p_start and p_end),
    'hires', (select count(*) from candidates where start_date between w_start and w_end),
    'hires_prev', (select count(*) from candidates where start_date between p_start and p_end),
    'papers', (select count(*) from candidates where paper_date between w_start and w_end),
    'new_partners', (select count(*) from freelancers where duplicate_of is null and (created_at at time zone 'Africa/Cairo')::date between w_start and w_end),
    'bonus', (select coalesce(sum(amount), 0) from bonus_ledger where reversed_at is null and earned_on between w_start and w_end),
    'paid', (select coalesce(sum(amount), 0) from withdrawals where status = 'paid' and (decided_at at time zone 'Africa/Cairo')::date between w_start and w_end)
  ) into r;
  return r;
end $$;
revoke all on function public.weekly_report_data() from public, anon, authenticated;
grant execute on function public.weekly_report_data() to service_role;

-- ---------------------------------------------------------------- Saturday 09:00 Egypt (07:00 UTC) weekly report push to staff
select cron.unschedule('weekly-admin-report') where exists (select 1 from cron.job where jobname = 'weekly-admin-report');
select cron.schedule('weekly-admin-report', '0 7 * * 6', $cron$
  select net.http_post(
    url := 'https://iwszjkdwnqnylogbklou.supabase.co/functions/v1/push',
    body := '{"action":"weekly_report"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-key', (select value from public.app_secrets where key = 'push_key')),
    timeout_milliseconds := 15000)
$cron$);
