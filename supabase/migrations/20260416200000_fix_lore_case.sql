-- Fix lore category and visibility CHECK constraints to use Title Case,
-- matching the Zod schemas in shared/src/schemas.ts.
-- This mirrors the campaign status fix in 20260416143136_fix_campaign_status_casing.sql.

-- category: lowercase → Title Case, add 'Other'
ALTER TABLE lore
  DROP CONSTRAINT IF EXISTS lore_category_check;

ALTER TABLE lore
  ADD CONSTRAINT lore_category_check
    CHECK (category IN ('History', 'Magic', 'Religion', 'Politics', 'Other'));

-- visibility: lowercase → Title Case
ALTER TABLE lore
  DROP CONSTRAINT IF EXISTS lore_visibility_check;

ALTER TABLE lore
  ADD CONSTRAINT lore_visibility_check
    CHECK (visibility IN ('Public', 'Private', 'Revealed'));

-- Coerce any existing dev-data rows to Title Case
UPDATE lore
SET
  category   = initcap(category),
  visibility = initcap(visibility)
WHERE category  = lower(category)
   OR visibility = lower(visibility);
