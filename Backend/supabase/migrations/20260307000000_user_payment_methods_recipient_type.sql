ALTER TABLE user_payment_methods
  ADD COLUMN IF NOT EXISTS recipient_type TEXT NOT NULL DEFAULT 'nuban';

UPDATE user_payment_methods SET recipient_type = 'nuban' WHERE recipient_type IS NULL;
