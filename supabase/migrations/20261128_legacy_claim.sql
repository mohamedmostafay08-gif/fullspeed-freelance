-- 28 Nov 2026: partners from the old Google Sheet app ("Freelance project") claim their account in the new app
-- with their OLD password. Old passwords are kept only as bcrypt hashes, never as text, and are deleted once used.
-- Used by the `claim` edge function (service role only).

create extension if not exists pgcrypto with schema extensions;

create table if not exists private.legacy_passwords (
  freelancer_id uuid primary key references public.freelancers(id) on delete cascade,
  pw_hash text not null,
  attempts int not null default 0,
  locked_until timestamptz,
  imported_at timestamptz not null default now()
);
revoke all on private.legacy_passwords from public, anon, authenticated;

-- Returns {result: ok|not_found|locked|wrong_old_password, freelancer_id?, minutes?, left?}
create or replace function public.svc_check_legacy_password(p_mobile text, p_password text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare fid uuid; lp private.legacy_passwords;
begin
  select f.id into fid from public.freelancers f
   where f.mobile = public.norm_mobile(p_mobile) and f.duplicate_of is null limit 1;
  if fid is null then return jsonb_build_object('result', 'not_found'); end if;
  select * into lp from private.legacy_passwords where freelancer_id = fid for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if lp.locked_until > now() then
    return jsonb_build_object('result', 'locked', 'minutes', ceil(extract(epoch from lp.locked_until - now()) / 60));
  end if;
  if extensions.crypt(btrim(coalesce(p_password, '')), lp.pw_hash) = lp.pw_hash then
    update private.legacy_passwords set attempts = 0, locked_until = null where freelancer_id = fid;
    return jsonb_build_object('result', 'ok', 'freelancer_id', fid);
  end if;
  if lp.attempts + 1 >= 5 then
    update private.legacy_passwords set attempts = 0, locked_until = now() + interval '1 hour' where freelancer_id = fid;
    return jsonb_build_object('result', 'locked', 'minutes', 60);
  end if;
  update private.legacy_passwords set attempts = lp.attempts + 1 where freelancer_id = fid;
  return jsonb_build_object('result', 'wrong_old_password', 'left', 5 - (lp.attempts + 1));
end $$;

create or replace function public.svc_forget_legacy_password(p_freelancer uuid)
returns void language sql security definer set search_path = '' as $$
  delete from private.legacy_passwords where freelancer_id = p_freelancer
$$;

revoke all on function public.svc_check_legacy_password(text, text) from public, anon, authenticated;
revoke all on function public.svc_forget_legacy_password(uuid) from public, anon, authenticated;
grant execute on function public.svc_check_legacy_password(text, text) to service_role;
grant execute on function public.svc_forget_legacy_password(uuid) to service_role;

-- Staff can see how many old accounts are still waiting to be claimed (counts only, no hashes).
create or replace function public.legacy_claim_stats()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.has_perm('partners') then
    jsonb_build_object('waiting', (select count(*) from private.legacy_passwords),
                       'locked', (select count(*) from private.legacy_passwords where locked_until > now()))
  end
$$;
revoke all on function public.legacy_claim_stats() from public, anon;
grant execute on function public.legacy_claim_stats() to authenticated;
