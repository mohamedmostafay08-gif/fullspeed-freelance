-- Phase 4: area-name normalization, client error log, privacy-friendly usage counters,
-- admin push subscriptions + daily report (pg_cron -> push edge function).

-- ---------------------------------------------------------------- 1. normalize governorate / area names
create or replace function public.norm_area(p text)
returns text language sql immutable set search_path = public as $$
  select nullif(trim(replace(regexp_replace(
           regexp_replace(
             regexp_replace(translate(coalesce(p, ''), 'أإآ', 'ااا'), 'ى(?=\s|$)', 'ي', 'g'),
           'ه(?=\s|$)', 'ة', 'g'),
         '\s+', ' ', 'g'), 'اللة', 'الله')), '')
$$;
create or replace function public.norm_gov(p text)
returns text language sql immutable set search_path = public as $$
  select case public.norm_area(p) when 'المنصورة' then 'الدقهلية' else public.norm_area(p) end
$$;
create or replace function public.jobs_normalize()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.norm_area(new.gov) = 'المنصورة' and coalesce(trim(new.region), '') = '' then new.region := 'المنصورة'; end if;
  new.gov := public.norm_gov(new.gov);
  new.region := public.norm_area(new.region);
  return new;
end $$;
drop trigger if exists jobs_normalize on public.jobs;
create trigger jobs_normalize before insert or update of gov, region on public.jobs
  for each row execute function public.jobs_normalize();
-- one-time cleanup (each changed row is recorded by the existing audit_jobs trigger)
update public.jobs set gov = gov, region = region
 where gov is distinct from public.norm_gov(gov) or region is distinct from public.norm_area(region)
    or (public.norm_area(gov) = 'المنصورة');

-- ---------------------------------------------------------------- 2. client error log
create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  app text not null,
  message text not null,
  stack text,
  url text,
  ua text,
  user_id uuid
);
create index if not exists client_errors_at_idx on public.client_errors (at desc);
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;
grant select on public.client_errors to authenticated;
grant all on public.client_errors to service_role;
drop policy if exists client_errors_select on public.client_errors;
create policy client_errors_select on public.client_errors for select to authenticated using (public.has_perm('audit'));

create or replace function public.log_client_error(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.client_errors where at > now() - interval '1 hour') >= 300 then return; end if;
  insert into public.client_errors (app, message, stack, url, ua, user_id)
  values (left(coalesce(p->>'app', '?'), 20), left(coalesce(p->>'message', '?'), 500), left(p->>'stack', 2000),
          left(p->>'url', 300), left(p->>'ua', 200), auth.uid());
end $$;
revoke all on function public.log_client_error(jsonb) from public;
grant execute on function public.log_client_error(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------- 3. usage counters (no personal data)
create table if not exists public.usage_daily (
  day date not null default current_date,
  event text not null,
  n integer not null default 0,
  primary key (day, event)
);
alter table public.usage_daily enable row level security;
revoke all on public.usage_daily from anon, authenticated;
grant select on public.usage_daily to authenticated;
grant all on public.usage_daily to service_role;
drop policy if exists usage_select on public.usage_daily;
create policy usage_select on public.usage_daily for select to authenticated using (public.has_perm('view'));

create or replace function public.track_event(p_event text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_event !~ '^[a-z0-9_:.-]{2,40}$' then return; end if;
  insert into public.usage_daily (day, event, n) values ((now() at time zone 'Africa/Cairo')::date, p_event, 1)
  on conflict (day, event) do update set n = public.usage_daily.n + 1;
end $$;
revoke all on function public.track_event(text) from public;
grant execute on function public.track_event(text) to anon, authenticated;

-- ---------------------------------------------------------------- 4. admin push + daily report
create table if not exists public.staff_push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
alter table public.staff_push_subscriptions enable row level security;
revoke all on public.staff_push_subscriptions from anon, authenticated;
grant all on public.staff_push_subscriptions to service_role;

create or replace function public.save_staff_push(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('view') then raise exception 'not_allowed'; end if;
  if coalesce(p->>'endpoint', '') !~ '^https://' then raise exception 'invalid_input'; end if;
  insert into public.staff_push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p->>'endpoint', p->>'p256dh', p->>'auth')
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;
create or replace function public.remove_staff_push(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.staff_push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;
revoke all on function public.save_staff_push(jsonb), public.remove_staff_push(text) from public, anon;
grant execute on function public.save_staff_push(jsonb), public.remove_staff_push(text) to authenticated;

create or replace function public.daily_report_data()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'new_candidates', (select count(*) from public.candidates where created_at > now() - interval '24 hours'),
    'self_joins', (select count(*) from public.candidates where source = 'self' and created_at > now() - interval '24 hours'),
    'started', (select count(*) from public.candidates where start_date >= current_date - 1),
    'stale', (select count(*) from public.candidates where status = 'submitted' and created_at < now() - interval '48 hours'),
    'wd_pending', (select count(*) from public.withdrawals where status = 'pending'),
    'wd_amount', (select coalesce(sum(amount), 0) from public.withdrawals where status = 'pending'),
    'unread_msgs', (select count(*) from public.messages where not from_staff and read_at is null),
    'pending_partners', (select count(*) from public.freelancers where status = 'Pending' and duplicate_of is null),
    'errors', (select count(*) from public.client_errors where at > now() - interval '24 hours'));
$$;
revoke all on function public.daily_report_data() from public, anon, authenticated;
grant execute on function public.daily_report_data() to service_role;

-- 07:00 UTC = 09:00 Cairo (winter) / 10:00 (summer)
select cron.unschedule('daily-admin-report') where exists (select 1 from cron.job where jobname = 'daily-admin-report');
select cron.schedule('daily-admin-report', '0 7 * * *', $cron$
  select net.http_post(
    url := 'https://iwszjkdwnqnylogbklou.supabase.co/functions/v1/push',
    body := '{"action":"daily_report"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-key', (select value from public.app_secrets where key = 'push_key')),
    timeout_milliseconds := 15000)
$cron$);
