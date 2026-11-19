-- Phase 5: admin control — settings, fine-grained staff permissions, freeze partner, revert from audit log,
-- broadcasts, new-job announcements, read-only "view as partner".

-- ---------------------------------------------------------------- 1. settings (readable by the apps, editable by staff with 'settings')
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
grant select on public.app_settings to anon, authenticated;
grant all on public.app_settings to service_role;
drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings for select to anon, authenticated using (true);
drop trigger if exists audit_app_settings on public.app_settings;
create trigger audit_app_settings after insert or update or delete on public.app_settings for each row execute function public.audit_trigger();

insert into public.app_settings (key, value) values
  ('announcement', '{"on": false, "text": "", "tone": "info", "link": ""}'),
  ('features', '{"chat": true, "join": true, "story": true, "passkey": true, "push_prompt": true, "map": true}'),
  ('levels', '[{"n":"مبتدئ","min":0,"c":"#8a86a8","i":"🌱"},{"n":"برونزي","min":1,"c":"#c8661b","i":"🥉"},{"n":"فضي","min":5,"c":"#64748b","i":"🥈"},{"n":"ذهبي","min":15,"c":"#c99400","i":"🥇"},{"n":"ماسي","min":30,"c":"#7b5cff","i":"💎"}]'),
  ('job_broadcast', '"all"')
on conflict (key) do nothing;

create or replace function public.feature_on(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value->>p_key)::boolean from public.app_settings where key = 'features'), true)
$$;

-- ---------------------------------------------------------------- 2. fine-grained staff permissions (owner always keeps everything)
alter table public.staff add column if not exists perms text[];

create or replace function public.role_perms(p_role text)
returns text[] language sql immutable as $$
  select case p_role
    when 'owner'     then array['view','partners','couriers','withdrawals','companies','jobs','audit','staff','settings','broadcast','revert']
    when 'admin'     then array['view','partners','couriers','withdrawals','companies','jobs','audit','settings','broadcast']
    when 'finance'   then array['view','withdrawals']
    when 'recruiter' then array['view','couriers','jobs']
    when 'viewer'    then array['view']
    else array[]::text[] end
$$;

create or replace function public.my_perms()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce((select case when s.role = 'owner' or s.perms is null then public.role_perms(s.role) else s.perms end
                     from public.staff s where s.user_id = auth.uid() and s.active), array[]::text[])
$$;

create or replace function public.has_perm(p_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_perm = any(public.my_perms())
$$;

create or replace function public.admin_set_staff_perms(p_user uuid, p_perms text[])
returns void language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if not public.has_perm('staff') then raise exception 'not_allowed'; end if;
  select role into v_role from public.staff where user_id = p_user;
  if v_role is null then raise exception 'not_found'; end if;
  if v_role = 'owner' then raise exception 'owner_has_all'; end if;
  if p_perms is not null and exists (select 1 from unnest(p_perms) x
       where x not in ('view','partners','couriers','withdrawals','companies','jobs','audit','settings','broadcast')) then
    raise exception 'invalid_input';
  end if;
  update public.staff set perms = p_perms where user_id = p_user;
end $$;
revoke all on function public.my_perms(), public.admin_set_staff_perms(uuid, text[]) from public, anon;
grant execute on function public.my_perms(), public.admin_set_staff_perms(uuid, text[]) to authenticated;

create or replace function public.admin_set_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('settings') then raise exception 'not_allowed'; end if;
  if p_key not in ('announcement','features','levels','job_broadcast') then raise exception 'invalid_input'; end if;
  insert into public.app_settings (key, value, updated_at, updated_by) values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
end $$;
revoke all on function public.admin_set_setting(text, jsonb) from public, anon;
grant execute on function public.admin_set_setting(text, jsonb) to authenticated;

-- ---------------------------------------------------------------- 3. freeze a partner (blocks withdrawals and new nominations)
alter table public.freelancers add column if not exists frozen_at timestamptz, add column if not exists frozen_reason text;

create or replace function public.frozen_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.freelancers where id = new.freelancer_id and frozen_at is not null)
     and not public.has_perm('partners') then
    raise exception 'account_frozen';
  end if;
  return new;
end $$;
revoke all on function public.frozen_guard() from public, anon, authenticated;
drop trigger if exists candidates_frozen_guard on public.candidates;
create trigger candidates_frozen_guard before insert on public.candidates for each row execute function public.frozen_guard();
drop trigger if exists withdrawals_frozen_guard on public.withdrawals;
create trigger withdrawals_frozen_guard before insert on public.withdrawals for each row execute function public.frozen_guard();

create or replace function public.admin_set_frozen(p_freelancer uuid, p_on boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_perm('partners') then raise exception 'not_allowed'; end if;
  if p_on and coalesce(trim(p_reason), '') = '' then raise exception 'reason_required'; end if;
  update public.freelancers set frozen_at = case when p_on then now() end, frozen_reason = case when p_on then left(trim(p_reason), 300) end
   where id = p_freelancer;
  if not found then raise exception 'not_found'; end if;
  perform public.notify(p_freelancer, case when p_on then 'frozen' else 'unfrozen' end,
    case when p_on then '🔒 حسابك متجمّد مؤقتاً' else '✅ اتفك تجميد حسابك' end,
    case when p_on then 'السحب والترشيح موقوفين لحد ما الإدارة تراجع. كلّم الإدارة لو محتاج تفاصيل.' else 'تقدر ترشّح وتسحب عادي.' end, 'chat');
end $$;
revoke all on function public.admin_set_frozen(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_frozen(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------- 4. revert an update from the audit log (owner only)
create or replace function public.admin_revert_audit(p_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare a record; cur jsonb; cur_sub jsonb; cols text; vals text;
begin
  if not public.has_perm('revert') then raise exception 'not_allowed'; end if;
  select * into a from public.audit_log where id = p_id;
  if not found then raise exception 'not_found'; end if;
  if a.action <> 'update' then raise exception 'only_updates'; end if;
  if a.table_name not in ('candidates','freelancers','jobs','companies','bonus_rules') then raise exception 'table_not_allowed'; end if;
  execute format('select to_jsonb(t) from public.%I t where id::text = $1', a.table_name) into cur using a.record_id;
  if cur is null then raise exception 'not_found'; end if;
  select jsonb_object_agg(k, cur->k) into cur_sub from jsonb_object_keys(a.after) k where k <> 'updated_at';
  if cur_sub is distinct from (a.after - 'updated_at') then raise exception 'changed_since'; end if;
  select string_agg(format('%I', k), ', '), string_agg(format('r.%I', k), ', ') into cols, vals
    from jsonb_object_keys(a.before) k
   where k not in ('id','created_at','updated_at') and (a.before->k) is distinct from (a.after->k);
  if cols is null then return 'nothing'; end if;
  execute format('update public.%I t set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1) r) where t.id::text = $2',
                 a.table_name, cols, vals, a.table_name) using a.before, a.record_id;
  return 'ok';
end $$;
revoke all on function public.admin_revert_audit(bigint) from public, anon;
grant execute on function public.admin_revert_audit(bigint) to authenticated;

-- ---------------------------------------------------------------- 5. broadcasts to partner segments
create or replace function public.broadcast_targets(p_filter jsonb)
returns setof uuid language sql stable security definer set search_path = public as $$
  select f.id from public.freelancers f
   where f.status = 'Active' and f.duplicate_of is null
     and (coalesce(p_filter->>'gov', '') = '' or public.norm_gov(f.gov) = public.norm_gov(p_filter->>'gov'))
     and (coalesce((p_filter->>'min_hired')::int, 0) = 0
          or (select count(*) from public.candidates c where c.freelancer_id = f.id and c.status = 'hired') >= (p_filter->>'min_hired')::int)
     and (coalesce((p_filter->>'max_hired')::int, -1) < 0
          or (select count(*) from public.candidates c where c.freelancer_id = f.id and c.status = 'hired') <= (p_filter->>'max_hired')::int)
     and (coalesce((p_filter->>'inactive_days')::int, 0) = 0
          or not exists (select 1 from public.candidates c where c.freelancer_id = f.id
                          and c.created_at > now() - make_interval(days => (p_filter->>'inactive_days')::int)))
$$;
revoke all on function public.broadcast_targets(jsonb) from public, anon, authenticated;

create or replace function public.admin_broadcast_count(p_filter jsonb)
returns int language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm('broadcast') then raise exception 'not_allowed'; end if;
  return (select count(*) from public.broadcast_targets(p_filter));
end $$;

create or replace function public.admin_broadcast(p_title text, p_body text, p_filter jsonb, p_link text default 'home')
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.has_perm('broadcast') then raise exception 'not_allowed'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'invalid_input'; end if;
  insert into public.notifications (freelancer_id, kind, title, body, link)
  select t, 'broadcast', left(trim(p_title), 120), left(trim(coalesce(p_body, '')), 500),
         case when p_link in ('home','jobs','couriers','wallet','me','chat') then p_link else 'home' end
    from public.broadcast_targets(p_filter) t;
  get diagnostics n = row_count;
  insert into public.audit_log (actor, actor_email, actor_role, action, table_name, record_id, before, after)
  values (auth.uid(), (select email from public.staff where user_id = auth.uid()), public.my_staff_role(), 'broadcast', 'notifications', null, null,
          jsonb_build_object('title', p_title, 'body', p_body, 'filter', p_filter, 'recipients', n));
  return n;
end $$;
revoke all on function public.admin_broadcast_count(jsonb), public.admin_broadcast(text, text, jsonb, text) from public, anon;
grant execute on function public.admin_broadcast_count(jsonb), public.admin_broadcast(text, text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------- 6. announce new jobs (setting job_broadcast: all | gov | off)
create or replace function public.jobs_broadcast()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_mode text;
begin
  if new.status <> 'Active' or (tg_op = 'UPDATE' and old.status = 'Active') then return new; end if;
  select value #>> '{}' into v_mode from public.app_settings where key = 'job_broadcast';
  v_mode := coalesce(v_mode, 'all');
  if v_mode = 'off' then return new; end if;
  insert into public.notifications (freelancer_id, kind, title, body, link)
  select f.id, 'new_job', '🚀 وظيفة جديدة: ' || left(new.title, 80),
         coalesce((select name from public.companies where id = new.company_id), new.company_name, '')
           || ' · ' || coalesce(new.gov, '') || coalesce(' — ' || new.region, '') || ' — رشّح مناديب واكسب بونص', 'jobs'
    from public.freelancers f
   where f.status = 'Active' and f.duplicate_of is null
     and (v_mode <> 'gov' or public.norm_gov(f.gov) = public.norm_gov(new.gov));
  return new;
exception when others then return new;
end $$;
revoke all on function public.jobs_broadcast() from public, anon, authenticated;
drop trigger if exists jobs_broadcast on public.jobs;
create trigger jobs_broadcast after insert or update of status on public.jobs for each row execute function public.jobs_broadcast();

-- ---------------------------------------------------------------- 7. read-only "view as partner" for staff
create or replace function public.list_open_jobs()
returns table(id uuid, code text, company_id uuid, company text, logo_url text, title text, age text, gov text, region text,
              work_type text, vehicle text, docs text, details text, pricing text, bonus_text text, headcount integer,
              applicants bigint, expiry date, created_at timestamptz, lat double precision, lng double precision, geo_precision text)
language sql stable security definer set search_path = public as $$
  select j.id, j.code, j.company_id, coalesce(c.name, j.company_name), c.logo_url, j.title, j.age, j.gov, j.region,
         j.work_type, j.vehicle, j.docs, j.details, j.pricing, j.bonus_text, j.headcount,
         (select count(*) from public.candidates x where x.job_id = j.id and x.status <> 'rejected'),
         j.expiry, j.created_at, j.lat, j.lng, j.geo_precision
    from public.jobs j left join public.companies c on c.id = j.company_id
   where (public.my_freelancer_id() is not null or public.has_perm('view'))
     and j.status = 'Active'
     and (j.expiry is null or j.expiry >= current_date)
     and (j.headcount is null or (select count(*) from public.candidates x where x.job_id = j.id and x.status <> 'rejected') < j.headcount)
   order by j.created_at desc
$$;

create or replace function public.summary_json(p_fl uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f record; b record;
begin
  select * into f from public.freelancers where id = p_fl;
  if not found then return jsonb_build_object('freelancer', null); end if;
  select * into b from public.freelancer_balances where freelancer_id = f.id;
  return jsonb_build_object(
    'freelancer', jsonb_build_object('id', f.id, 'name', f.name, 'mobile', f.mobile, 'email', f.email,
                                     'gov', f.gov, 'region', f.region, 'status', f.status, 'created_at', f.created_at,
                                     'ref_code', f.ref_code, 'frozen', f.frozen_at is not null, 'frozen_reason', f.frozen_reason),
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
revoke all on function public.summary_json(uuid) from public, anon, authenticated;

create or replace function public.my_summary()
returns jsonb language plpgsql security definer set search_path = public as $$
declare fid uuid; st text;
begin
  select id, status into fid, st from public.freelancers where user_id = auth.uid() and duplicate_of is null;
  if fid is null then return jsonb_build_object('freelancer', null); end if;
  if st = 'Active' then perform public.accrue_freelancer(fid); end if;
  return public.summary_json(fid);
end $$;

create or replace function public.admin_freelancer_summary(p_freelancer uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm('view') then raise exception 'not_allowed'; end if;
  return public.summary_json(p_freelancer);
end $$;
revoke all on function public.admin_freelancer_summary(uuid) from public, anon;
grant execute on function public.admin_freelancer_summary(uuid) to authenticated;

-- ---------------------------------------------------------------- 8. respect feature switches on the server
create or replace function public.public_ref_info(p_ref text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f record;
begin
  if not public.feature_on('join') then return null; end if;
  select id, split_part(name, ' ', 1) as first_name into f from public.freelancers
   where ref_code = lower(trim(p_ref)) and status = 'Active' and duplicate_of is null and frozen_at is null;
  if not found then return null; end if;
  return jsonb_build_object('partner', f.first_name,
    'jobs', coalesce((select jsonb_agg(jsonb_build_object('id', j.id, 'title', j.title, 'company', coalesce(c.name, j.company_name),
              'logo_url', c.logo_url, 'gov', j.gov, 'region', j.region, 'vehicle', j.vehicle, 'work_type', j.work_type, 'pricing', j.pricing)
              order by j.created_at desc)
       from public.jobs j left join public.companies c on c.id = j.company_id
      where j.status = 'Active' and (j.expiry is null or j.expiry >= current_date)
        and (j.headcount is null or (select count(*) from public.candidates x where x.job_id = j.id and x.status <> 'rejected') < j.headcount)), '[]'::jsonb));
end $$;

create or replace function public.send_message(p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare fid uuid := public.my_freelancer_id(); v bigint;
begin
  if fid is null then raise exception 'not_freelancer'; end if;
  if not public.feature_on('chat') then raise exception 'feature_off'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'invalid_input'; end if;
  if (select count(*) from public.messages where freelancer_id = fid and not from_staff and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited';
  end if;
  insert into public.messages (freelancer_id, body) values (fid, left(trim(p_body), 2000)) returning id into v;
  return v;
end $$;
