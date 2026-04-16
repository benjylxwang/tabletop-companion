-- =============================================================
-- campaign_invitations
-- Replaces direct campaign_members insertion on invite.
-- The DM creates a pending invitation; the invited user accepts
-- (which creates the campaign_members row) or declines.
-- =============================================================

create table campaign_invitations (
  id                  uuid        primary key default gen_random_uuid(),
  campaign_id         uuid        not null references campaigns(id) on delete cascade,
  invited_user_id     uuid        not null references auth.users(id) on delete cascade,
  invited_by_user_id  uuid        not null references auth.users(id) on delete cascade,
  status              text        not null default 'pending'
                                  check (status in ('pending', 'accepted', 'declined')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- One pending invite per user per campaign; declined can be re-invited
  unique (campaign_id, invited_user_id)
);

-- Fast "all pending invitations for this user" lookup
create index on campaign_invitations (invited_user_id, status);

-- Fast "all pending invitations for this campaign" lookup (DM view)
create index on campaign_invitations (campaign_id, status);

alter table campaign_invitations enable row level security;

create trigger update_campaign_invitations_updated_at
  before update on campaign_invitations
  for each row execute procedure update_updated_at_column();
