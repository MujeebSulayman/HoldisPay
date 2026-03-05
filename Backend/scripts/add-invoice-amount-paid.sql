-- Add amount paid columns to invoices (run in Supabase SQL editor if not using migrations)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS amount_paid text,
  ADD COLUMN IF NOT EXISTS amount_paid_usd text;
