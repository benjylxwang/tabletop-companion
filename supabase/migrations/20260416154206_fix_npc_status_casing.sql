-- Fix npcs.status to use title case to match the Zod NpcStatusEnum
-- ('Alive' | 'Dead' | 'Unknown' instead of 'alive' | 'dead' | 'unknown').
-- This is a dev-only migration; no production rows exist yet.

DO $$
DECLARE
  v_con TEXT;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'npcs' AND c.contype = 'c' AND c.conname LIKE '%status%';

  IF v_con IS NOT NULL THEN
    EXECUTE 'ALTER TABLE npcs DROP CONSTRAINT ' || quote_ident(v_con);
  END IF;
END
$$;

UPDATE npcs SET status = INITCAP(status);

ALTER TABLE npcs ALTER COLUMN status SET DEFAULT 'Alive';

ALTER TABLE npcs
  ADD CONSTRAINT npcs_status_check
  CHECK (status IN ('Alive', 'Dead', 'Unknown'));
