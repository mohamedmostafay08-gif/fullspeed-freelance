# Status after the 23 Nov 2026 audit

Done on 23 Nov 2026 (Supabase project `iwszjkdwnqnylogbklou`, work account; the GitHub account is a member of its org):
- Migrations applied: fix_ref_code_case, security_hardening_20261123, daily_internal_backup, advisor_fixes_20261123.
- Edge functions deployed from the repo: push (v4), admin-users (v6).
- Verified: no upper-case referral codes existed; no partner login is a staff login; request_withdrawal locks the
  partner row (FOR UPDATE); no failed cron runs.
- Free backup: `backup.take_snapshot()` runs nightly at 00:35 Cairo and keeps 7 days in schema `backup`.

Done later on 23 Nov 2026 (migration rate_limits_staff_sessions_20261123, passkey v4, push v5):
- log_client_error / track_event are limited per signed-in user or per visitor IP (private.rate_ok, schema `private`).
- passkey challenges: capped per IP and overall; expired rows cleaned hourly by cron `fsf-cleanup`.
- Staff sign-ins: a trigger on auth.sessions writes a 'server' row in staff_logins for every staff session;
  the panel's log-login call fills that row with the device. A 'server' row left as is = the device never reported.
- Push sends go out 50 at a time, with results written in bulk.
- Visitors can no longer call internal helpers (jobs_normalize, campaign_matches, contest_state).
- SRI hashes on every CDN script/stylesheet (Leaflet, QR, html2canvas, jsPDF). esm.sh ES modules are version-pinned
  only (SRI does not cover their nested imports).
- Partner app: the phone's back button closes the open sheet, then returns to Home, then leaves the app.
- Already in place (no change needed): signup rejects partner logins without kind=freelancer and blocks
  untrusted non-partner e-mails once an owner exists.

Still open (owner decisions):
- "Job is full": partners and join links stop at non-rejected nominations >= headcount, while automation closes
  only at hired >= headcount. Pick one rule.
- SMS verification of the mobile number at partner sign-up.
- DNS CNAME `freelance` -> `fullspeed-freelance.pages.dev` in Cloudflare, and add the hostname to Turnstile.
- Off-site backup: `.github/workflows/backup.yml` needs repo secrets SUPABASE_DB_URL (Session pooler) and
  BACKUP_PASSPHRASE, added by the owner.
- Leaked-password protection in Supabase Auth settings (dashboard only).
