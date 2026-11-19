-- Phase 3: jobs map coordinates, web push, passkey login. Additive except list_open_jobs,
-- which is dropped and recreated because its return columns change (same body + lat/lng).

-- ---------------------------------------------------------------- 1. jobs map
alter table public.jobs
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists geo_precision text;  -- 'pin' (admin), 'region', 'gov' (approximate)

drop function if exists public.list_open_jobs();
create function public.list_open_jobs()
returns table(id uuid, code text, company_id uuid, company text, logo_url text, title text, age text, gov text, region text,
              work_type text, vehicle text, docs text, details text, pricing text, bonus_text text, headcount integer,
              applicants bigint, expiry date, created_at timestamptz, lat double precision, lng double precision, geo_precision text)
language sql stable security definer set search_path = public as $$
  select j.id, j.code, j.company_id, coalesce(c.name, j.company_name), c.logo_url, j.title, j.age, j.gov, j.region,
         j.work_type, j.vehicle, j.docs, j.details, j.pricing, j.bonus_text, j.headcount,
         (select count(*) from public.candidates x where x.job_id = j.id and x.status <> 'rejected'),
         j.expiry, j.created_at, j.lat, j.lng, j.geo_precision
    from public.jobs j left join public.companies c on c.id = j.company_id
   where public.my_freelancer_id() is not null
     and j.status = 'Active'
     and (j.expiry is null or j.expiry >= current_date)
     and (j.headcount is null or (select count(*) from public.candidates x where x.job_id = j.id and x.status <> 'rejected') < j.headcount)
   order by j.created_at desc
$$;
revoke all on function public.list_open_jobs() from public, anon;
grant execute on function public.list_open_jobs() to authenticated;

-- ---------------------------------------------------------------- 2. server-only secrets (RLS on, no policies, no grants)
create table if not exists public.app_secrets (key text primary key, value text not null, updated_at timestamptz not null default now());
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
insert into public.app_secrets (key, value)
values ('push_key', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- ---------------------------------------------------------------- 3. web push
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  freelancer_id uuid not null references public.freelancers(id),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  ua text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index if not exists push_subs_fl_idx on public.push_subscriptions (freelancer_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

create or replace function public.save_push_subscription(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare fid uuid := public.my_freelancer_id();
begin
  if fid is null then raise exception 'not_freelancer'; end if;
  if coalesce(p->>'endpoint', '') !~ '^https://' or coalesce(p->>'p256dh', '') = '' or coalesce(p->>'auth', '') = '' then raise exception 'invalid_input'; end if;
  insert into public.push_subscriptions (freelancer_id, endpoint, p256dh, auth, ua)
  values (fid, p->>'endpoint', p->>'p256dh', p->>'auth', left(p->>'ua', 200))
  on conflict (endpoint) do update set freelancer_id = excluded.freelancer_id, p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua;
end $$;
create or replace function public.remove_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and freelancer_id = public.my_freelancer_id();
$$;
create or replace function public.my_push_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.push_subscriptions where freelancer_id = public.my_freelancer_id();
$$;
revoke all on function public.save_push_subscription(jsonb), public.remove_push_subscription(text), public.my_push_count() from public, anon;
grant execute on function public.save_push_subscription(jsonb), public.remove_push_subscription(text), public.my_push_count() to authenticated;

create extension if not exists pg_net with schema extensions;

create or replace function public.push_on_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if not exists (select 1 from public.push_subscriptions where freelancer_id = new.freelancer_id) then return new; end if;
  select value into k from public.app_secrets where key = 'push_key';
  perform net.http_post(
    url := 'https://iwszjkdwnqnylogbklou.supabase.co/functions/v1/push',
    body := jsonb_build_object('id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-key', k),
    timeout_milliseconds := 8000);
  return new;
exception when others then return new; -- push is best-effort
end $$;
revoke all on function public.push_on_notification() from public, anon, authenticated;
drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications
  for each row execute function public.push_on_notification();

-- ---------------------------------------------------------------- 4. passkeys (fingerprint / face login)
create table if not exists public.passkeys (
  id text primary key,                 -- credential id (base64url)
  user_id uuid not null references auth.users(id) on delete cascade,
  public_key text not null,            -- base64url COSE key
  counter bigint not null default 0,
  transports text[],
  device text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists passkeys_user_idx on public.passkeys (user_id);
alter table public.passkeys enable row level security;
revoke all on public.passkeys from anon, authenticated;
grant select (id, device, created_at, last_used_at) on public.passkeys to authenticated;
drop policy if exists passkeys_select_own on public.passkeys;
create policy passkeys_select_own on public.passkeys for select to authenticated using (user_id = auth.uid());

create table if not exists public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge text not null,
  user_id uuid,
  expires_at timestamptz not null default now() + interval '5 minutes'
);
alter table public.webauthn_challenges enable row level security;
revoke all on public.webauthn_challenges from anon, authenticated;

create or replace function public.remove_my_passkey(p_id text)
returns void language sql security definer set search_path = public as $$
  delete from public.passkeys where id = p_id and user_id = auth.uid();
$$;
revoke all on function public.remove_my_passkey(text) from public, anon;
grant execute on function public.remove_my_passkey(text) to authenticated;

-- grants (applied as grants_for_new_tables): this project does not auto-grant on new tables
grant select on public.notifications, public.messages to authenticated;
grant all on public.notifications, public.messages, public.app_secrets, public.webauthn_challenges, public.passkeys, public.push_subscriptions to service_role;
grant usage, select on all sequences in schema public to service_role;
