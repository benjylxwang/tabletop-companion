-- Fix campaigns.status to use title case to match the Zod CampaignStatusEnum
-- ('Active' | 'Hiatus' | 'Complete' instead of 'active' | 'hiatus' | 'complete').
-- This is a dev-only migration; no production rows exist yet.

DO $$
DECLARE
  v_con TEXT;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'campaigns' AND c.contype = 'c' AND c.conname LIKE '%status%';

  IF v_con IS NOT NULL THEN
    EXECUTE 'ALTER TABLE campaigns DROP CONSTRAINT ' || quote_ident(v_con);
  END IF;
END
$$;

UPDATE campaigns SET status = INITCAP(status);

ALTER TABLE campaigns ALTER COLUMN status SET DEFAULT 'Active';

ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_status_check
  CHECK (status IN ('Active', 'Hiatus', 'Complete'));
