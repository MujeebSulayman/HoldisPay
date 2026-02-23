-- Fix: allow user delete by cascading deletes to transactions
-- Run once on existing DBs that have transactions.user_id without ON DELETE CASCADE

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
