-- =============================================================
-- Two fixes for the campaign invitation system:
--
-- 1. Backfill profiles for any auth.users rows that pre-date
--    the handle_new_user trigger (e.g. test accounts created
--    before 20260416144000_profiles.sql was applied).
--    Without a profiles row, getUserByEmail() returns null and
--    the DM cannot invite those users at all.
--
-- 2. Replace the non-partial unique constraint on
--    campaign_invitations(campaign_id, invited_user_id) with a
--    partial unique index that only covers status = 'pending'.
--    The old constraint prevented re-inviting a user who had
--    previously declined — the INSERT would fail with a unique
--    violation even though the existing row was 'declined'.
-- =============================================================

-- 1. Backfill missing profiles
insert into public.profiles (id, email, display_name)
select
  u.id,
  u.email,
  nullif(u.raw_user_meta_data ->> 'display_name', '')
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

-- 2. Fix the unique constraint on campaign_invitations
alter table campaign_invitations
  drop constraint campaign_invitations_campaign_id_invited_user_id_key;

create unique index campaign_invitations_one_pending_per_user
  on campaign_invitations (campaign_id, invited_user_id)
  where status = 'pending';
