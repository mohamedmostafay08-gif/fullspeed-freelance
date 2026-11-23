-- Referral codes are matched in lower case by public_ref_info / public_join.
-- The admin partner form briefly saved them in upper case (19–23 Nov 2026), which broke those partners' join links.
-- Restore every code to lower case and stop it from happening again.
update public.freelancers set ref_code = lower(ref_code) where ref_code is not null and ref_code <> lower(ref_code);

alter table public.freelancers drop constraint if exists freelancers_ref_code_lower;
alter table public.freelancers add constraint freelancers_ref_code_lower check (ref_code is null or ref_code = lower(ref_code));
