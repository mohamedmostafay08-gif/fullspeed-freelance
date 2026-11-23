-- 23 Nov 2026 audit, low-priority items:
--   1. per-client rate limits on log_client_error / track_event (anyone with the public key could flood them)
--   2. passkey challenge flood guard + hourly cleanup
--   3. staff sign-ins recorded by the database itself, not only when the browser reports them
--   4. internal helpers no longer callable by visitors

-- ---------------------------------------------------------------- 1. rate limiter (private schema, not exposed by the API)
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.rate_hits (
  k text not null,
  bucket timestamptz not null,
  n int not null default 0,
  primary key (k, bucket)
);

-- true while the caller is under p_max hits in the current p_secs window
create or replace function private.rate_ok(p_key text, p_max int, p_secs int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare b timestamptz := to_timestamp(floor(extract(epoch from now()) / p_secs) * p_secs); v int;
begin
  insert into private.rate_hits (k, bucket, n) values (left(p_key, 120), b, 1)
  on conflict (k, bucket) do update set n = private.rate_hits.n + 1
  returning n into v;
  return v <= p_max;
end $$;

-- who is calling: the signed-in user, else the visitor's IP as forwarded to the API
create or replace function private.client_key()
returns text language plpgsql stable security definer set search_path = '' as $$
declare h json; ip text;
begin
  if auth.uid() is not null then return 'u:' || auth.uid()::text; end if;
  begin h := nullif(current_setting('request.headers', true), '')::json; exception when others then h := null; end;
  ip := coalesce(h->>'cf-connecting-ip', split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1), h->>'x-real-ip');
  return 'ip:' || coalesce(nullif(trim(ip), ''), 'unknown');
end $$;

create or replace function public.log_client_error(p jsonb)
returns void language plpgsql security definer set search_path = 'public' as $$
declare k text := private.client_key();
begin
  -- 20 reports per client per 10 minutes (unknown IPs share a bigger bucket), 300 per hour overall
  if not private.rate_ok('err:' || k, case when k = 'ip:unknown' then 100 else 20 end, 600) then return; end if;
  if (select count(*) from public.client_errors where at > now() - interval '1 hour') >= 300 then return; end if;
  insert into public.client_errors (app, message, stack, url, ua, user_id)
  values (left(coalesce(p->>'app', '?'), 20), left(coalesce(p->>'message', '?'), 500), left(p->>'stack', 2000),
          left(p->>'url', 300), left(p->>'ua', 200), auth.uid());
end $$;

create or replace function public.track_event(p_event text)
returns void language plpgsql security definer set search_path = 'public' as $$
declare k text;
begin
  if p_event !~ '^[a-z0-9_:.-]{2,40}$' then return; end if;
  k := private.client_key();
  if not private.rate_ok('ev:' || k, case when k = 'ip:unknown' then 2000 else 200 end, 600) then return; end if;
  insert into public.usage_daily (day, event, n) values ((now() at time zone 'Africa/Cairo')::date, p_event, 1)
  on conflict (day, event) do update set n = public.usage_daily.n + 1;
end $$;

-- the passkey edge function (service role) uses the same limiter
create or replace function public.svc_rate_ok(p_key text, p_max int, p_secs int)
returns boolean language sql security definer set search_path = '' as $$ select private.rate_ok(p_key, p_max, p_secs) $$;
revoke all on function public.svc_rate_ok(text, int, int) from public, anon, authenticated;
grant execute on function public.svc_rate_ok(text, int, int) to service_role;

-- ---------------------------------------------------------------- 2. hourly cleanup
create or replace function private.cleanup()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from private.rate_hits where bucket < now() - interval '1 day';
  delete from public.webauthn_challenges where expires_at < now();
end $$;
select cron.unschedule('fsf-cleanup') where exists (select 1 from cron.job where jobname = 'fsf-cleanup');
select cron.schedule('fsf-cleanup', '41 * * * *', $$select private.cleanup()$$);

-- ---------------------------------------------------------------- 3. staff sign-ins recorded server-side
alter table public.staff_logins add column if not exists session_id uuid;
alter table public.staff_logins drop constraint if exists staff_logins_method_check;
alter table public.staff_logins add constraint staff_logins_method_check
  check (method in ('password', 'passkey', 'session', 'server'));
create index if not exists staff_logins_session_idx on public.staff_logins (session_id);

-- Every new auth session of a staff member gets a row here at once ('server').
-- When the panel then reports the device, the edge function fills in that same row.
-- Never blocks a sign-in: any error is swallowed.
create or replace function public.staff_session_log()
returns trigger language plpgsql security definer set search_path = 'public' as $$
declare st record;
begin
  begin
    select email into st from public.staff where user_id = new.user_id;
    if found then
      insert into public.staff_logins (user_id, email, method, device_hash, ua, ip, new_device, session_id)
      values (new.user_id, st.email, 'server', 'server', left(new.user_agent, 300), host(new.ip), false, new.id);
    end if;
  exception when others then null;
  end;
  return new;
end $$;
revoke all on function public.staff_session_log() from public, anon, authenticated;
drop trigger if exists staff_session_log on auth.sessions;
create trigger staff_session_log after insert on auth.sessions for each row execute function public.staff_session_log();

-- ---------------------------------------------------------------- 4. helpers visitors never need
revoke execute on function public.jobs_normalize() from public, anon, authenticated;
revoke execute on function public.campaign_matches(public.bonus_campaigns, public.candidates) from public, anon;
grant execute on function public.campaign_matches(public.bonus_campaigns, public.candidates) to authenticated, service_role;
revoke execute on function public.contest_state(public.contests) from public, anon;
grant execute on function public.contest_state(public.contests) to authenticated, service_role;
