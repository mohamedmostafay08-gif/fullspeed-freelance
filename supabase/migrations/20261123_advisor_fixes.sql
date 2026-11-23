-- Supabase security advisor follow-ups (23 Nov 2026).
do $$ declare r record; begin
  for r in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.proname in ('role_perms', 'contest_state') loop
    execute format('alter function %s set search_path = public', r.sig);
  end loop;
end $$;
revoke all on function public.auth_email_guard() from public, anon, authenticated;
revoke all on function public.candidates_guard() from public, anon, authenticated;
revoke all on function public.accrue_all() from public, anon, authenticated;
