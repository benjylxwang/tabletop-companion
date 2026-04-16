-- =============================================================
-- Tabletop Companion — Initial Schema
-- All DM-only fields are prefixed with dm_ (e.g. dm_notes).
-- Content tables carry visibility + revealed_to for the
-- permission model (private / public / revealed).
--
-- RLS is enabled on every table (deny-by-default for anon/authenticated).
-- The API uses the service role key, which bypasses RLS entirely.
-- Add role-based policies here once authentication is implemented.
-- =============================================================

-- =============================================================
-- HELPER: keep updated_at in sync automatically
-- =============================================================

create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================
-- campaigns
-- Top-level container — no campaign_id, no visibility column.
-- =============================================================

create table campaigns (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  system          text,
  description     text,
  cover_image_url text,
  status          text        not null default 'Active'
                              check (status in ('Active', 'Hiatus', 'Complete')),
  dm_notes        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table campaigns enable row level security;

create trigger update_campaigns_updated_at
  before update on campaigns
  for each row execute procedure update_updated_at_column();

-- =============================================================
-- campaign_members
-- Source of truth for per-campaign role (dm / player).
-- Required by auth middleware and all downstream permission checks.
-- No updated_at — rows are append-only; membership changes via insert/delete.
-- =============================================================

create table campaign_members (
  campaign_id uuid        not null references campaigns(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  role        text        not null check (role in ('dm', 'player')),
  joined_at   timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

-- Index on user_id alone for "all campaigns this user belongs to" queries.
-- The composite (campaign_id, user_id) index is already provided by the PK.
create index on campaign_members (user_id);

alter table campaign_members enable row level security;

-- =============================================================
-- sessions
-- session_number is auto-assigned per campaign by the trigger below.
-- =============================================================

create table sessions (
  id             uuid        primary key default gen_random_uuid(),
  campaign_id    uuid        not null references campaigns(id) on delete cascade,
  session_number integer     not null,
  title          text,
  date_played    date,
  summary        text,
  highlights     text[],
  xp_awarded     integer,
  visibility     text        not null default 'public'
                             check (visibility in ('private', 'public', 'revealed')),
  revealed_to    uuid[],
  dm_notes       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (campaign_id, session_number)
);

alter table sessions enable row level security;

create trigger update_sessions_updated_at
  before update on sessions
  for each row execute procedure update_updated_at_column();

-- Auto-assign session_number = max(session_number)+1 per campaign on insert.
-- Only runs when session_number is not explicitly provided.
create or replace function assign_session_number()
returns trigger language plpgsql as $$
begin
  if new.session_number is null then
    select coalesce(max(session_number), 0) + 1
    into new.session_number
    from sessions
    where campaign_id = new.campaign_id;
  end if;
  return new;
end;
$$;

create trigger assign_session_number_before_insert
  before insert on sessions
  for each row execute procedure assign_session_number();

-- =============================================================
-- characters (player characters — PCs)
-- =============================================================

create table characters (
  id                  uuid        primary key default gen_random_uuid(),
  campaign_id         uuid        not null references campaigns(id) on delete cascade,
  name                text        not null,
  player_name         text,
  race_species        text,
  class               text,
  level_tier          integer,
  backstory           text,
  appearance          text,
  personality         text,
  goals_bonds         text,
  character_sheet_url text,
  journal             text,
  visibility          text        not null default 'public'
                                  check (visibility in ('private', 'public', 'revealed')),
  revealed_to         uuid[],
  dm_notes            text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table characters enable row level security;

create trigger update_characters_updated_at
  before update on characters
  for each row execute procedure update_updated_at_column();

-- =============================================================
-- factions
-- Must be created before npcs (npcs hold a faction_id FK).
-- =============================================================

create table factions (
  id             uuid        primary key default gen_random_uuid(),
  campaign_id    uuid        not null references campaigns(id) on delete cascade,
  name           text        not null,
  description    text,
  goals          text,
  alignment_tone text,
  visibility     text        not null default 'public'
                             check (visibility in ('private', 'public', 'revealed')),
  revealed_to    uuid[],
  dm_notes       text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table factions enable row level security;

create trigger update_factions_updated_at
  before update on factions
  for each row execute procedure update_updated_at_column();

-- =============================================================
-- npcs (non-player characters)
-- first_appeared_session_id and faction_id are nullable FKs.
-- =============================================================

create table npcs (
  id                        uuid        primary key default gen_random_uuid(),
  campaign_id               uuid        not null references campaigns(id) on delete cascade,
  name                      text        not null,
  role_title                text,
  alignment                 text,
  appearance                text,
  personality               text,
  relationships             text,
  status                    text        not null default 'Alive'
                                        check (status in ('Alive', 'Dead', 'Unknown')),
  first_appeared_session_id uuid        references sessions(id) on delete set null,
  faction_id                uuid        references factions(id) on delete set null,
  visibility                text        not null default 'public'
                                        check (visibility in ('private', 'public', 'revealed')),
  revealed_to               uuid[],
  dm_notes                  text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table npcs enable row level security;

create trigger update_npcs_updated_at
  before update on npcs
  for each row execute procedure update_updated_at_column();

-- =============================================================
-- locations
-- Hierarchical — parent_location_id is a nullable self-reference.
-- =============================================================

create table locations (
  id                 uuid        primary key default gen_random_uuid(),
  campaign_id        uuid        not null references campaigns(id) on delete cascade,
  name               text        not null,
  type               text,
  description        text,
  history            text,
  map_image_url      text,
  parent_location_id uuid        references locations(id) on delete set null,
  visibility         text        not null default 'public'
                                 check (visibility in ('private', 'public', 'revealed')),
  revealed_to        uuid[],
  dm_notes           text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table locations enable row level security;

create trigger update_locations_updated_at
  before update on locations
  for each row execute procedure update_updated_at_column();

-- =============================================================
-- lore (world-building entries)
-- =============================================================

create table lore (
  id          uuid        primary key default gen_random_uuid(),
  campaign_id uuid        not null references campaigns(id) on delete cascade,
  title       text        not null,
  category    text        not null
                          check (category in ('history', 'magic', 'religion', 'politics', 'other')),
  content     text,
  visibility  text        not null default 'public'
                          check (visibility in ('private', 'public', 'revealed')),
  revealed_to uuid[],
  dm_notes    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table lore enable row level security;

create trigger update_lore_updated_at
  before update on lore
  for each row execute procedure update_updated_at_column();

-- =============================================================
-- JUNCTION TABLES
--
-- Each junction table validates that both sides belong to the
-- same campaign via a BEFORE INSERT OR UPDATE trigger.
-- This prevents cross-campaign links that would violate tenant isolation.
-- =============================================================

-- session ↔ NPC (which NPCs appeared in a session)
create table session_npcs (
  session_id uuid not null references sessions(id) on delete cascade,
  npc_id     uuid not null references npcs(id)     on delete cascade,
  primary key (session_id, npc_id)
);

alter table session_npcs enable row level security;

create or replace function check_session_npc_same_campaign()
returns trigger language plpgsql as $$
declare
  v_session_campaign uuid;
  v_npc_campaign     uuid;
begin
  select campaign_id into v_session_campaign from sessions   where id = new.session_id;
  select campaign_id into v_npc_campaign     from npcs       where id = new.npc_id;
  if v_session_campaign is distinct from v_npc_campaign then
    raise exception 'session (%) and npc (%) must belong to the same campaign',
      new.session_id, new.npc_id;
  end if;
  return new;
end;
$$;

create trigger check_session_npc_same_campaign
  before insert or update on session_npcs
  for each row execute procedure check_session_npc_same_campaign();

-- session ↔ location (which locations featured in a session)
create table session_locations (
  session_id  uuid not null references sessions(id)  on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  primary key (session_id, location_id)
);

alter table session_locations enable row level security;

create or replace function check_session_location_same_campaign()
returns trigger language plpgsql as $$
declare
  v_session_campaign  uuid;
  v_location_campaign uuid;
begin
  select campaign_id into v_session_campaign  from sessions  where id = new.session_id;
  select campaign_id into v_location_campaign from locations where id = new.location_id;
  if v_session_campaign is distinct from v_location_campaign then
    raise exception 'session (%) and location (%) must belong to the same campaign',
      new.session_id, new.location_id;
  end if;
  return new;
end;
$$;

create trigger check_session_location_same_campaign
  before insert or update on session_locations
  for each row execute procedure check_session_location_same_campaign();

-- faction ↔ NPC membership
create table faction_members (
  faction_id uuid not null references factions(id) on delete cascade,
  npc_id     uuid not null references npcs(id)     on delete cascade,
  role       text,
  primary key (faction_id, npc_id)
);

alter table faction_members enable row level security;

create or replace function check_faction_member_same_campaign()
returns trigger language plpgsql as $$
declare
  v_faction_campaign uuid;
  v_npc_campaign     uuid;
begin
  select campaign_id into v_faction_campaign from factions where id = new.faction_id;
  select campaign_id into v_npc_campaign     from npcs     where id = new.npc_id;
  if v_faction_campaign is distinct from v_npc_campaign then
    raise exception 'faction (%) and npc (%) must belong to the same campaign',
      new.faction_id, new.npc_id;
  end if;
  return new;
end;
$$;

create trigger check_faction_member_same_campaign
  before insert or update on faction_members
  for each row execute procedure check_faction_member_same_campaign();

-- faction ↔ faction relationships (inter-faction dynamics)
create table faction_relationships (
  faction_id         uuid not null references factions(id) on delete cascade,
  related_faction_id uuid not null references factions(id) on delete cascade,
  relationship_type  text not null,
  dm_notes           text,
  primary key (faction_id, related_faction_id),
  check (faction_id != related_faction_id)
);

alter table faction_relationships enable row level security;

create or replace function check_faction_relationship_same_campaign()
returns trigger language plpgsql as $$
declare
  v_faction_a_campaign uuid;
  v_faction_b_campaign uuid;
begin
  select campaign_id into v_faction_a_campaign from factions where id = new.faction_id;
  select campaign_id into v_faction_b_campaign from factions where id = new.related_faction_id;
  if v_faction_a_campaign is distinct from v_faction_b_campaign then
    raise exception 'factions (%) and (%) must belong to the same campaign',
      new.faction_id, new.related_faction_id;
  end if;
  return new;
end;
$$;

create trigger check_faction_relationship_same_campaign
  before insert or update on faction_relationships
  for each row execute procedure check_faction_relationship_same_campaign();

-- =============================================================
-- lore ↔ entity references (polymorphic)
--
-- entity_id cannot carry a typed FK because it references different tables
-- depending on entity_type. Orphan cleanup is handled by the triggers below,
-- which delete lore_references rows when the referenced entity is deleted.
-- =============================================================

create table lore_references (
  lore_id     uuid not null references lore(id) on delete cascade,
  entity_type text not null
              check (entity_type in ('campaign', 'session', 'character', 'npc', 'location', 'faction')),
  entity_id   uuid not null,
  primary key (lore_id, entity_type, entity_id)
);

alter table lore_references enable row level security;

-- Cleanup trigger function: deletes lore_references rows for a deleted entity.
-- entity_type is passed as a trigger argument.
create or replace function cleanup_lore_references()
returns trigger language plpgsql as $$
begin
  delete from lore_references
  where entity_type = tg_argv[0] and entity_id = old.id;
  return old;
end;
$$;

create trigger cleanup_campaign_lore_refs
  after delete on campaigns
  for each row execute procedure cleanup_lore_references('campaign');

create trigger cleanup_session_lore_refs
  after delete on sessions
  for each row execute procedure cleanup_lore_references('session');

create trigger cleanup_character_lore_refs
  after delete on characters
  for each row execute procedure cleanup_lore_references('character');

create trigger cleanup_npc_lore_refs
  after delete on npcs
  for each row execute procedure cleanup_lore_references('npc');

create trigger cleanup_location_lore_refs
  after delete on locations
  for each row execute procedure cleanup_lore_references('location');

create trigger cleanup_faction_lore_refs
  after delete on factions
  for each row execute procedure cleanup_lore_references('faction');

-- Retrigger marker: no-op, forces the Migrate workflow to re-run under the
-- corrected `supabase link + db push` flow after the original run failed on
-- the old `--project-ref` flag. Supabase skips already-applied migrations by
-- version, so this trailing comment does not alter schema state.
