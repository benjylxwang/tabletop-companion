-- Indexes for campaign-scoped entity queries (all frequently filtered by campaign_id)
create index if not exists sessions_campaign_id_idx    on sessions    (campaign_id);
create index if not exists characters_campaign_id_idx  on characters  (campaign_id);
create index if not exists npcs_campaign_id_idx        on npcs        (campaign_id);
create index if not exists locations_campaign_id_idx   on locations   (campaign_id);
create index if not exists factions_campaign_id_idx    on factions    (campaign_id);
create index if not exists lore_campaign_id_idx        on lore        (campaign_id);

-- NPC FK columns used in joins
create index if not exists npcs_faction_id_idx                  on npcs (faction_id);
create index if not exists npcs_first_appeared_session_id_idx   on npcs (first_appeared_session_id);

-- Session ordering (frequently sorted by session_number descending)
create index if not exists sessions_campaign_session_num_idx    on sessions (campaign_id, session_number desc);
