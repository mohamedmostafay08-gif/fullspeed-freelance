-- Phase 6 (growth): campaign bonuses, monthly contests, partner quality score.
-- Additive only: new tables/functions, two new ledger kinds, and the ledger uniqueness index narrowed
-- so the new kinds can have one row per campaign/contest (existing kinds keep exactly the same rule).

-- ---------------------------------------------------------------- ledger: new kinds + links
alter table public.bonus_ledger add column if not exists campaign_id uuid;
alter table public.bonus_ledger add column if not exists contest_id uuid;

alter table public.bonus_ledger drop constraint bonus_ledger_kind_check;
alter table public.bonus_ledger add constraint bonus_ledger_kind_check
  check (kind = any (array['paper','days','adjustment','campaign','contest']));
alter table public.bonus_ledger drop constraint bonus_ledger_check;
alter table public.bonus_ledger add constraint bonus_ledger_check
  check (kind in ('adjustment','contest') or candidate_id is not null);
alter table public.bonus_ledger add constraint bonus_ledger_campaign_link check (kind <> 'campaign' or campaign_id is not null);
alter table public.bonus_ledger add constraint bonus_ledger_contest_link check (kind <> 'contest' or (contest_id is not null and freelancer_id is not null));

-- Same rule as before for paper/days; campaign and contest rows get their own "once" rules.
create unique index if not exists ledger_once_v2 on public.bonus_ledger (candidate_id, kind, coalesce(tier_days, 0))
  where reversed_at is null and kind in ('paper','days');
drop index if exists public.ledger_once;
alter index public.ledger_once_v2 rename to ledger_once;
create unique index if not exists ledger_campaign_once on public.bonus_ledger (candidate_id, campaign_id)
  where reversed_at is null and kind = 'campaign';
create unique index if not exists ledger_contest_once on public.bonus_ledger (contest_id, freelancer_id)
  where reversed_at is null and kind = 'contest';

-- Notification text for the new kinds (paper/days/adjustment unchanged).
create or replace function public.notify_ledger_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.amount > 0 and new.freelancer_id is not null then
    perform public.notify(new.freelancer_id, 'bonus', '💰 بونص جديد +' || public.fmt_amount(new.amount) || ' ج',
      case new.kind when 'paper' then 'بونص ورق' when 'days' then 'بونص ' || new.tier_days || ' يوم شغل'
        when 'campaign' then '🎯 بونص حملة: ' || coalesce(new.note, '')
        when 'contest' then '🏆 ' || coalesce(new.note, 'جايزة مسابقة')
        else coalesce(new.note, 'تسوية من الإدارة') end, 'wallet');
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- campaigns
create table if not exists public.bonus_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80),
  amount numeric not null check (amount > 0 and amount <= 100000),
  scope text not null default 'all' check (scope in ('all','partner','gov','company')),
  scope_value text,
  starts_on date not null,
  ends_on date not null,
  trigger_kind text not null default 'days' check (trigger_kind in ('paper','days')),
  min_days int not null default 26 check (min_days between 1 and 365),
  active boolean not null default true,
  note text,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (scope = 'all' or nullif(trim(scope_value), '') is not null)
);
alter table public.bonus_campaigns enable row level security;
grant select, insert, update on public.bonus_campaigns to authenticated;
grant all on public.bonus_campaigns to service_role;
create policy campaigns_read on public.bonus_campaigns for select to authenticated using (public.has_perm('view'));
create policy campaigns_ins on public.bonus_campaigns for insert to authenticated with check (public.has_perm('companies'));
create policy campaigns_upd on public.bonus_campaigns for update to authenticated using (public.has_perm('companies')) with check (public.has_perm('companies'));
create trigger audit_bonus_campaigns after insert or update or delete on public.bonus_campaigns for each row execute function public.audit_trigger();
create trigger bonus_campaigns_touch before update on public.bonus_campaigns for each row execute function public.touch_updated_at();
alter table public.bonus_ledger add constraint bonus_ledger_campaign_fk foreign key (campaign_id) references public.bonus_campaigns(id);

-- Does campaign k apply to candidate c? (nominated inside the window + scope match)
create or replace function public.campaign_matches(k public.bonus_campaigns, c public.candidates) returns boolean
language sql stable set search_path = public as $$
  select (c.created_at at time zone 'Africa/Cairo')::date between k.starts_on and k.ends_on
     and case k.scope
           when 'all' then true
           when 'partner' then c.freelancer_id::text = k.scope_value
           when 'company' then c.company_id::text = k.scope_value
           when 'gov' then public.norm_gov(c.gov) = public.norm_gov(k.scope_value)
         end
$$;

-- Adds/reverses campaign bonuses for one candidate. Mirrors accrue_candidate's trigger rules.
create or replace function public.accrue_campaigns(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.candidates; k public.bonus_campaigns; v_days int; reached boolean;
begin
  select * into c from public.candidates where id = p_id;
  if not found then return; end if;
  if c.status = 'rejected' then
    update public.bonus_ledger set reversed_at = now(), reversed_by = auth.uid(), reverse_reason = 'courier rejected'
     where candidate_id = c.id and kind = 'campaign' and reversed_at is null;
    return;
  end if;
  v_days := case when c.start_date is not null and (c.status = 'hired' or (c.status = 'suspended' and c.end_date is not null))
                 then least(coalesce(c.end_date, current_date), current_date) - c.start_date else 0 end;
  for k in select * from public.bonus_campaigns where active loop
    continue when not public.campaign_matches(k, c);
    reached := case k.trigger_kind when 'paper' then c.paper_date is not null else v_days >= k.min_days end;
    continue when not reached;
    -- once per (candidate, campaign); a row staff reversed by hand is never re-added
    continue when exists (select 1 from public.bonus_ledger l where l.candidate_id = c.id and l.campaign_id = k.id
                            and (l.reversed_at is null or l.reverse_reason <> 'courier rejected'));
    insert into public.bonus_ledger (freelancer_id, candidate_id, kind, campaign_id, amount, earned_on, note)
    values (c.freelancer_id, c.id, 'campaign', k.id, k.amount,
            case k.trigger_kind when 'paper' then c.paper_date else c.start_date + k.min_days end, k.name)
    on conflict do nothing;
  end loop;
end $$;
revoke all on function public.accrue_campaigns(uuid) from public, anon, authenticated;

-- Hook: same places tier bonuses are accrued (row change + nightly run).
create or replace function public.candidates_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT'
     or new.status is distinct from old.status or new.paper_date is distinct from old.paper_date
     or new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date
     or new.company_id is distinct from old.company_id then
    perform public.accrue_candidate(new.id);
    perform public.accrue_campaigns(new.id);
  end if;
  return new;
end $$;

create or replace function public.accrue_all() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  if not (public.has_perm('view') or coalesce(auth.role(), '') = 'service_role' or auth.uid() is null) then
    raise exception 'not_allowed';
  end if;
  for r in select id from public.candidates where status in ('hired','suspended') and start_date is not null
           or (paper_date is not null and status <> 'rejected')
  loop perform public.accrue_candidate(r.id); perform public.accrue_campaigns(r.id); n := n + 1; end loop;
  return n;
end $$;

-- Staff: run a campaign over existing candidates right after creating/editing it.
create or replace function public.admin_apply_campaign(p_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare k public.bonus_campaigns; r record; n0 int; n1 int;
begin
  if not public.has_perm('companies') then raise exception 'not_allowed'; end if;
  select * into k from public.bonus_campaigns where id = p_id;
  if not found then raise exception 'not_found'; end if;
  select count(*) into n0 from public.bonus_ledger where campaign_id = p_id and reversed_at is null;
  for r in select c.id from public.candidates c
            where (c.created_at at time zone 'Africa/Cairo')::date between k.starts_on and k.ends_on and c.status <> 'rejected'
  loop perform public.accrue_campaigns(r.id); end loop;
  select count(*) into n1 from public.bonus_ledger where campaign_id = p_id and reversed_at is null;
  return n1 - n0;
end $$;
revoke all on function public.admin_apply_campaign(uuid) from public, anon;
grant execute on function public.admin_apply_campaign(uuid) to authenticated;

-- Staff: totals per campaign (eligible couriers, paid rows, amount).
create or replace function public.admin_campaign_stats() returns table(campaign_id uuid, eligible int, earned_rows int, earned_amount numeric)
language sql stable security definer set search_path = public as $$
  select k.id,
         (select count(*)::int from public.candidates c where c.status <> 'rejected' and public.campaign_matches(k, c)),
         (select count(*)::int from public.bonus_ledger l where l.campaign_id = k.id and l.reversed_at is null),
         (select coalesce(sum(l.amount), 0) from public.bonus_ledger l where l.campaign_id = k.id and l.reversed_at is null)
    from public.bonus_campaigns k
   where public.has_perm('view')
$$;
revoke all on function public.admin_campaign_stats() from public, anon;
grant execute on function public.admin_campaign_stats() to authenticated;

-- Partner: campaigns running now that can pay them (all / my governorate couriers / a company / me).
create or replace function public.my_campaigns() returns table(id uuid, name text, amount numeric, scope text, scope_label text,
  starts_on date, ends_on date, trigger_kind text, min_days int, note text)
language sql stable security definer set search_path = public as $$
  select k.id, k.name, k.amount, k.scope,
         case k.scope when 'company' then (select name from public.companies where id::text = k.scope_value)
                      when 'gov' then k.scope_value when 'partner' then null else null end,
         k.starts_on, k.ends_on, k.trigger_kind, k.min_days, k.note
    from public.bonus_campaigns k
   where k.active and current_date between k.starts_on and k.ends_on
     and public.my_freelancer_id() is not null
     and (k.scope <> 'partner' or k.scope_value = public.my_freelancer_id()::text)
   order by k.ends_on
$$;
revoke all on function public.my_campaigns() from public, anon;
grant execute on function public.my_campaigns() to authenticated;

-- ---------------------------------------------------------------- contests
create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 2 and 100),
  metric text not null default 'hires' check (metric in ('hires','nominations','completed')),
  starts_on date not null,
  ends_on date not null,
  prizes jsonb not null default '[]'::jsonb check (jsonb_typeof(prizes) = 'array'),
  scope_gov text,
  scope_company uuid references public.companies(id),
  status text not null default 'draft' check (status in ('draft','live','awarded','cancelled')),
  note text,
  created_by uuid default auth.uid() references auth.users(id),
  awarded_by uuid references auth.users(id),
  awarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
alter table public.contests enable row level security;
grant select, insert, update on public.contests to authenticated;
grant all on public.contests to service_role;
create policy contests_read on public.contests for select to authenticated using (public.has_perm('view'));
create policy contests_ins on public.contests for insert to authenticated with check (public.has_perm('companies') and status in ('draft','live'));
-- awarding only happens through admin_award_contest
create policy contests_upd on public.contests for update to authenticated
  using (public.has_perm('companies') and status <> 'awarded') with check (public.has_perm('companies') and status <> 'awarded');
create trigger audit_contests after insert or update or delete on public.contests for each row execute function public.audit_trigger();
create trigger contests_touch before update on public.contests for each row execute function public.touch_updated_at();

create table if not exists public.contest_awards (
  id bigint generated always as identity primary key,
  contest_id uuid not null references public.contests(id),
  freelancer_id uuid not null references public.freelancers(id),
  rank int,
  score int not null default 0,
  amount numeric not null default 0,
  excluded boolean not null default false,
  exclude_reason text,
  ledger_id bigint references public.bonus_ledger(id),
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  unique (contest_id, freelancer_id)
);
alter table public.contest_awards enable row level security;
grant select on public.contest_awards to authenticated;
grant all on public.contest_awards to service_role;
create policy contest_awards_read on public.contest_awards for select to authenticated
  using (public.has_perm('view') or freelancer_id = public.my_freelancer_id());
create trigger audit_contest_awards after insert or update or delete on public.contest_awards for each row execute function public.audit_trigger();
alter table public.bonus_ledger add constraint bonus_ledger_contest_fk foreign key (contest_id) references public.contests(id);

-- Effective status: a live contest past its end date is "ended" until the owner awards it.
create or replace function public.contest_state(k public.contests) returns text language sql stable as $$
  select case when k.status = 'live' and current_date > k.ends_on then 'ended'
              when k.status = 'live' and current_date < k.starts_on then 'upcoming'
              else k.status end
$$;

-- Scores for every partner in a contest (internal; callers check permissions).
--   hires       = couriers whose first work day falls in the window
--   nominations = couriers nominated in the window (rejected ones don't count)
--   completed   = couriers whose 26-day (or higher) tier bonus was earned in the window
create or replace function public.contest_scores(p_contest uuid)
returns table(freelancer_id uuid, score int, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  with k as (select * from public.contests where id = p_contest),
  c as (
    select c.* from public.candidates c, k
     where (k.scope_gov is null or public.norm_gov(c.gov) = public.norm_gov(k.scope_gov))
       and (k.scope_company is null or c.company_id = k.scope_company)
  ),
  ev as (
    select c.freelancer_id, c.start_date::timestamptz at_ from c, k
     where k.metric = 'hires' and c.start_date between k.starts_on and k.ends_on and c.status in ('hired','suspended')
    union all
    select c.freelancer_id, c.created_at from c, k
     where k.metric = 'nominations' and c.status <> 'rejected'
       and (c.created_at at time zone 'Africa/Cairo')::date between k.starts_on and k.ends_on
    union all
    select c.freelancer_id, max(l.earned_on)::timestamptz from c join public.bonus_ledger l on l.candidate_id = c.id, k
     where k.metric = 'completed' and l.kind = 'days' and l.reversed_at is null and l.tier_days >= 26
       and l.earned_on between k.starts_on and k.ends_on
     group by c.freelancer_id, c.id
  )
  select ev.freelancer_id, count(*)::int, max(ev.at_)
    from ev join public.freelancers f on f.id = ev.freelancer_id
   where f.duplicate_of is null and f.status = 'Active'
   group by ev.freelancer_id
$$;
revoke all on function public.contest_scores(uuid) from public, anon, authenticated;

-- Ranking: higher score first; ties go to whoever reached the score first.
create or replace function public.contest_ranking(p_contest uuid)
returns table(rank int, freelancer_id uuid, name text, gov text, score int, excluded boolean, exclude_reason text, amount numeric)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by s.score desc, s.last_at asc, f.name)::int, s.freelancer_id, f.name, f.gov, s.score,
         coalesce(a.excluded, false), a.exclude_reason, a.amount
    from public.contest_scores(p_contest) s
    join public.freelancers f on f.id = s.freelancer_id
    left join public.contest_awards a on a.contest_id = p_contest and a.freelancer_id = s.freelancer_id
   where s.score > 0
$$;
revoke all on function public.contest_ranking(uuid) from public, anon, authenticated;

create or replace function public.admin_contest_ranking(p_contest uuid)
returns table(rank int, freelancer_id uuid, name text, gov text, score int, excluded boolean, exclude_reason text, amount numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_perm('view') then raise exception 'not_allowed'; end if;
  return query select * from public.contest_ranking(p_contest);
end $$;
revoke all on function public.admin_contest_ranking(uuid) from public, anon;
grant execute on function public.admin_contest_ranking(uuid) to authenticated;

-- Owner confirms winners. p_exclude = [{"freelancer_id": "...", "reason": "..."}]. Never runs automatically.
create or replace function public.admin_award_contest(p_contest uuid, p_exclude jsonb default '[]'::jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare k public.contests; r record; pr jsonb; amt numeric; pos int := 0; n int := 0; lid bigint; ex record;
begin
  if public.my_staff_role() is distinct from 'owner' then raise exception 'not_allowed'; end if;
  select * into k from public.contests where id = p_contest for update;
  if not found then raise exception 'not_found'; end if;
  if k.status = 'awarded' then raise exception 'already_awarded'; end if;
  if k.status <> 'live' or current_date <= k.ends_on then raise exception 'contest_not_ended'; end if;
  -- record exclusions first
  for ex in select (e->>'freelancer_id')::uuid fid, nullif(trim(e->>'reason'), '') reason from jsonb_array_elements(coalesce(p_exclude, '[]'::jsonb)) e loop
    if ex.reason is null then raise exception 'reason_required'; end if;
    insert into public.contest_awards (contest_id, freelancer_id, excluded, exclude_reason, score)
    values (p_contest, ex.fid, true, ex.reason, coalesce((select s.score from public.contest_scores(p_contest) s where s.freelancer_id = ex.fid), 0))
    on conflict (contest_id, freelancer_id) do update set excluded = true, exclude_reason = excluded.exclude_reason;
  end loop;
  for r in select * from public.contest_ranking(p_contest) x
            where not exists (select 1 from public.contest_awards a where a.contest_id = p_contest and a.freelancer_id = x.freelancer_id and a.excluded)
            order by x.rank loop
    pos := pos + 1;
    select p into pr from jsonb_array_elements(k.prizes) p where (p->>'rank')::int = pos limit 1;
    exit when pr is null and pos > coalesce((select max((p->>'rank')::int) from jsonb_array_elements(k.prizes) p), 0);
    amt := coalesce((pr->>'amount')::numeric, 0);
    lid := null;
    if amt > 0 then
      insert into public.bonus_ledger (freelancer_id, kind, contest_id, amount, earned_on, note, created_by)
      values (r.freelancer_id, 'contest', p_contest, amt, current_date, 'جايزة ' || k.title || ' — المركز ' || pos, auth.uid())
      returning id into lid;
      n := n + 1;
    end if;
    insert into public.contest_awards (contest_id, freelancer_id, rank, score, amount, ledger_id)
    values (p_contest, r.freelancer_id, pos, r.score, amt, lid)
    on conflict (contest_id, freelancer_id) do update set rank = excluded.rank, score = excluded.score, amount = excluded.amount, ledger_id = excluded.ledger_id;
  end loop;
  update public.contests set status = 'awarded', awarded_by = auth.uid(), awarded_at = now() where id = p_contest;
  return n;
end $$;
revoke all on function public.admin_award_contest(uuid, jsonb) from public, anon;
grant execute on function public.admin_award_contest(uuid, jsonb) to authenticated;

-- Partner: current/recent contests + masked leaderboard + my own rank.
-- Excluded partners are dropped and the rest re-numbered, so shown ranks match awarded places.
create or replace function public.my_contests() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.my_freelancer_id(); res jsonb := '[]'::jsonb; k public.contests; board jsonb; mine jsonb;
begin
  if me is null then return res; end if;
  for k in select * from public.contests
            where status in ('live','awarded') and starts_on <= current_date + 7 and ends_on >= current_date - 14
            order by ends_on desc limit 3 loop
    with r as (
      select row_number() over (order by x.rank)::int pos, x.* from public.contest_ranking(k.id) x where not x.excluded
    )
    select coalesce((select jsonb_agg(jsonb_build_object(
             'rank', r.pos, 'score', r.score, 'me', r.freelancer_id = me,
             'name', case when r.freelancer_id = me then r.name
                          else split_part(trim(r.name), ' ', 1) || coalesce(' ' || nullif(left(split_part(trim(r.name), ' ', 2), 1), '') || '.', '') end)
             order by r.pos) from r where r.pos <= 10), '[]'::jsonb),
           (select jsonb_build_object('rank', r.pos, 'score', r.score) from r where r.freelancer_id = me)
      into board, mine;
    res := res || jsonb_build_object('id', k.id, 'title', k.title, 'metric', k.metric, 'starts_on', k.starts_on, 'ends_on', k.ends_on,
      'prizes', k.prizes, 'state', public.contest_state(k), 'note', k.note,
      'scope_gov', k.scope_gov, 'scope_company', (select name from public.companies where id = k.scope_company),
      'board', board, 'mine', mine,
      'award', (select jsonb_build_object('rank', a.rank, 'amount', a.amount) from public.contest_awards a where a.contest_id = k.id and a.freelancer_id = me and not a.excluded));
  end loop;
  return res;
end $$;
revoke all on function public.my_contests() from public, anon;
grant execute on function public.my_contests() to authenticated;

-- ---------------------------------------------------------------- partner quality score (0-100)
-- hire 35 = started / nominations older than 7 days
-- retention 25 = reached 26 days / started couriers old enough to have reached it (0.5 when none yet)
-- rejections 20 = 20 x (1 - rejected / nominations)
-- trust 10 = 10 x (1 - min(1, 0.5 x self-nominations + quick-quit share))   quick quit = left within 7 days
-- activity 10 = last nomination ≤14d → 10, ≤30d → 6, ≤60d → 3, else 0
create or replace function public.admin_partner_quality()
returns table(freelancer_id uuid, score int, nominations int, started int, completed int, rejected int,
              self_nominated int, quick_quits int, last_nomination timestamptz,
              p_hire numeric, p_retention numeric, p_reject numeric, p_trust numeric, p_activity numeric)
language sql stable security definer set search_path = public as $$
  with s as (
    select f.id fid,
      count(c.id)::int n,
      count(c.id) filter (where c.created_at < now() - interval '7 days')::int n_old,
      count(c.id) filter (where c.start_date is not null)::int st,
      count(c.id) filter (where c.start_date is not null and (c.end_date is not null or c.start_date <= current_date - 26))::int mature,
      count(c.id) filter (where c.start_date is not null and (
          exists (select 1 from public.bonus_ledger l where l.candidate_id = c.id and l.kind = 'days' and l.reversed_at is null and l.tier_days >= 26)
          or least(coalesce(c.end_date, current_date), current_date) - c.start_date >= 26))::int done,
      count(c.id) filter (where c.status = 'rejected')::int rej,
      count(c.id) filter (where c.mobile = f.mobile)::int self,
      count(c.id) filter (where c.end_date is not null and c.start_date is not null and c.end_date - c.start_date < 7)::int qq,
      max(c.created_at) last_at
    from public.freelancers f join public.candidates c on c.freelancer_id = f.id
    where f.duplicate_of is null
    group by f.id
  ), p as (
    select s.*,
      round(35 * least(1, s.st::numeric / greatest(s.n_old, 1)), 1) ph,
      round(25 * case when s.mature = 0 then 0.5 else least(1, s.done::numeric / s.mature) end, 1) pr,
      round(20 * (1 - s.rej::numeric / greatest(s.n, 1)), 1) pj,
      round(10 * (1 - least(1, 0.5 * s.self + s.qq::numeric / greatest(s.st, 1))), 1) pt,
      case when s.last_at > now() - interval '14 days' then 10 when s.last_at > now() - interval '30 days' then 6
           when s.last_at > now() - interval '60 days' then 3 else 0 end::numeric pa
    from s
  )
  select p.fid, round(p.ph + p.pr + p.pj + p.pt + p.pa)::int, p.n, p.st, p.done, p.rej, p.self, p.qq, p.last_at,
         p.ph, p.pr, p.pj, p.pt, p.pa
    from p
   where public.has_perm('view')
$$;
revoke all on function public.admin_partner_quality() from public, anon;
grant execute on function public.admin_partner_quality() to authenticated;
