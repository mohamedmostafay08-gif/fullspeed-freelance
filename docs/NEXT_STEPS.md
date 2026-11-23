# Status after the 23 Nov 2026 audit

Done on 23 Nov 2026 (Supabase project `iwszjkdwnqnylogbklou`, work account; the GitHub account is a member of its org):
- Migrations applied: fix_ref_code_case, security_hardening_20261123, daily_internal_backup, advisor_fixes_20261123.
- Edge functions deployed from the repo: push (v4), admin-users (v6).
- Verified: no upper-case referral codes existed; no partner login is a staff login; request_withdrawal locks the
  partner row (FOR UPDATE); no failed cron runs.
- Free backup: `backup.take_snapshot()` runs nightly at 00:35 Cairo and keeps 7 days in schema `backup`.

Still open (owner decisions):
- "Job is full": partners and join links stop at non-rejected nominations >= headcount, while automation closes
  only at hired >= headcount. Pick one rule.
- SMS verification of the mobile number at partner sign-up.
- DNS CNAME `freelance` -> `fullspeed-freelance.pages.dev` in Cloudflare, and add the hostname to Turnstile.
- Off-site backup: `.github/workflows/backup.yml` needs repo secrets SUPABASE_DB_URL (Session pooler) and
  BACKUP_PASSPHRASE, added by the owner.
- Leaked-password protection in Supabase Auth settings (dashboard only).
