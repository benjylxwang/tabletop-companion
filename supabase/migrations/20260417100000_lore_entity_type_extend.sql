-- Extend lore_references.entity_type to support lore-to-lore references (issue #30).
-- The original constraint only included campaign/session/character/npc/location/faction.

ALTER TABLE lore_references
  DROP CONSTRAINT lore_references_entity_type_check;

ALTER TABLE lore_references
  ADD CONSTRAINT lore_references_entity_type_check
  CHECK (entity_type IN ('campaign', 'session', 'character', 'npc', 'location', 'faction', 'lore'));
