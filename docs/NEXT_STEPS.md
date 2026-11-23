# Pending work after the 23 Nov 2026 audit

The Supabase project is `iwszjkdwnqnylogbklou`, owned by the work account
(mohamed.moustafa@fullspeedlogistics.com). Everything below needs a Supabase connector linked to that account.

## 1. Apply database migrations (in this order)
- `supabase/migrations/20261123_fix_ref_code_case.sql`: lower-cases referral codes that the admin form
  upper-cased between 19 and 23 Nov, and adds a check so it can't happen again.
- `supabase/migrations/20261123_security_hardening.sql`: settings visibility, levels validation, campaign
  permission, back-dated work dates (owner only), no SVG logos, courier-doc delete, admin_save_company grant,
  and inactive staff push subscriptions.

Before applying, confirm that the most recent migrations (phase 7: automation/receipts and staff security/report)
are listed in the project; the dashboard showed `phase6_growth_board_ranks` as the last migration.

## 2. Deploy edge functions from the repo
- `supabase/functions/admin-users`: refuses partner actions on staff logins and returns short error codes.
- `supabase/functions/push`: reports go to active staff only, and the push key is compared in constant time.

## 3. Verify in the database
- `request_withdrawal` locks the partner row (FOR UPDATE or an advisory lock) before checking the balance.
- Use one "job is full" rule in `run_automation`, `list_open_jobs` and `public_join`.
- Check `cron.job_run_details` for failures and `net._http_response` for push errors.
- Run the Supabase security and performance advisors.

## 4. Free daily backup inside the database
No Pro plan. Add a pg_cron job that copies the core tables (freelancers, candidates, bonus_ledger, withdrawals,
jobs, companies, bonus_rules, bonus_campaigns, contests, contest_awards, staff, app_settings) into a `backup`
schema, keeping the last 7 days.

The GitHub workflow `.github/workflows/backup.yml` also exists. It needs two repo secrets, added by the owner:
- `SUPABASE_DB_URL`: the Session pooler connection string.
- `BACKUP_PASSPHRASE`: the encryption passphrase.

## 5. Owner decisions still open
- Verify the mobile number with an SMS code when a partner signs up.
- Add a DNS CNAME `freelance` pointing to `fullspeed-freelance.pages.dev` in Cloudflare, and add that hostname
  to Turnstile.
