-- Free daily snapshot of the business tables inside the database (no Pro plan needed).
-- Each night (00:35 Cairo) copies them into schema "backup" as <table>__YYYYMMDD and keeps the last 7 days.
-- Restore example: insert into public.withdrawals select * from backup.withdrawals__20261123 where id = '...';
create schema if not exists backup;
revoke all on schema backup from public, anon, authenticated;

create or replace function backup.take_snapshot()
returns jsonb language plpgsql security definer set search_path = public, backup as $$
declare
  t text; n int := 0; dropped int := 0; r record;
  tag text := to_char((now() at time zone 'Africa/Cairo')::date, 'YYYYMMDD');
  tables text[] := array['freelancers','candidates','bonus_ledger','withdrawals','jobs','companies','bonus_rules',
                         'bonus_campaigns','contests','contest_awards','staff','app_settings','messages','audit_log'];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('drop table if exists backup.%I', t || '__' || tag);
      execute format('create table backup.%I as table public.%I', t || '__' || tag, t);
      n := n + 1;
    end if;
  end loop;
  for r in select tablename from pg_tables where schemaname = 'backup'
            and substring(tablename from '__([0-9]{8})$') is not null
            and to_date(substring(tablename from '__([0-9]{8})$'), 'YYYYMMDD') < (now() at time zone 'Africa/Cairo')::date - 6 loop
    execute format('drop table backup.%I', r.tablename); dropped := dropped + 1;
  end loop;
  return jsonb_build_object('copied', n, 'dropped', dropped, 'tag', tag);
end $$;
revoke all on function backup.take_snapshot() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'fsf-daily-backup';
select cron.schedule('fsf-daily-backup', '35 22 * * *', $$select backup.take_snapshot()$$);
