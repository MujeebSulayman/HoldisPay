-- Fix payment_contracts.release_type check constraint so it accepts API values.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor).
-- Step 1: Drop the old constraint so we can fix existing rows.
ALTER TABLE payment_contracts
  DROP CONSTRAINT IF EXISTS payment_contracts_release_type_check;

-- Step 2: Normalize existing rows to allowed values (PROJECT_BASED / TIME_BASED).
UPDATE payment_contracts
SET release_type = CASE
  WHEN TRIM(COALESCE(release_type, '')) IN ('PROJECT_BASED', 'TIME_BASED') THEN TRIM(release_type)
  WHEN LOWER(TRIM(COALESCE(release_type, ''))) IN ('time_based', 'timebased') THEN 'TIME_BASED'
  ELSE 'PROJECT_BASED'
END
WHERE COALESCE(TRIM(release_type), '') NOT IN ('PROJECT_BASED', 'TIME_BASED')
   OR release_type IS NULL;

-- Step 3: Add the new constraint.
ALTER TABLE payment_contracts
  ADD CONSTRAINT payment_contracts_release_type_check
  CHECK (release_type IN ('PROJECT_BASED', 'TIME_BASED'));
