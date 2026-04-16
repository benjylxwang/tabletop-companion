-- =============================================================
-- Tabletop Companion — Initial Schema
-- All DM-only fields are prefixed with dm_ (e.g. dm_notes).
-- Content tables carry visibility + revealed_to for the
-- permission model (private / public / revealed).
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
  status          text        not null default 'active'
                              check (status in ('active', 'hiatus', 'complete')),
  dm_notes        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table campaigns enable row level security;

-- v1 (DM-only, no auth yet): allow all access.
-- Replace with role-based policies when auth is implemented.
create policy "allow all" on campaigns for all using (true) with check (true);

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

create index on campaign_members (user_id);
create index on campaign_members (campaign_id, user_id);

alter table campaign_members enable row level security;

create policy "allow all" on campaign_members for all using (true) with check (true);

-- =============================================================
-- sessions
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

create policy "allow all" on sessions for all using (true) with check (true);

create trigger update_sessions_updated_at
  before update on sessions
  for each row execute procedure update_updated_at_column();

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

create policy "allow all" on characters for all using (true) with check (true);

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

create policy "allow all" on factions for all using (true) with check (true);

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
  status                    text        not null default 'alive'
                                        check (status in ('alive', 'dead', 'unknown')),
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

create policy "allow all" on npcs for all using (true) with check (true);

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

create policy "allow all" on locations for all using (true) with check (true);

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

create policy "allow all" on lore for all using (true) with check (true);

create trigger update_lore_updated_at
  before update on lore
  for each row execute procedure update_updated_at_column();

-- =============================================================
-- JUNCTION TABLES
-- =============================================================

-- session ↔ NPC (which NPCs appeared in a session)
create table session_npcs (
  session_id uuid not null references sessions(id) on delete cascade,
  npc_id     uuid not null references npcs(id)     on delete cascade,
  primary key (session_id, npc_id)
);

alter table session_npcs enable row level security;
create policy "allow all" on session_npcs for all using (true) with check (true);

-- session ↔ location (which locations featured in a session)
create table session_locations (
  session_id  uuid not null references sessions(id)  on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  primary key (session_id, location_id)
);

alter table session_locations enable row level security;
create policy "allow all" on session_locations for all using (true) with check (true);

-- faction ↔ NPC membership
create table faction_members (
  faction_id uuid not null references factions(id) on delete cascade,
  npc_id     uuid not null references npcs(id)     on delete cascade,
  role       text,
  primary key (faction_id, npc_id)
);

alter table faction_members enable row level security;
create policy "allow all" on faction_members for all using (true) with check (true);

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
create policy "allow all" on faction_relationships for all using (true) with check (true);

-- lore ↔ entity references (polymorphic — lore can reference any entity)
create table lore_references (
  lore_id     uuid not null references lore(id) on delete cascade,
  entity_type text not null
              check (entity_type in ('campaign', 'session', 'character', 'npc', 'location', 'faction')),
  entity_id   uuid not null,
  primary key (lore_id, entity_type, entity_id)
);

alter table lore_references enable row level security;
create policy "allow all" on lore_references for all using (true) with check (true);
