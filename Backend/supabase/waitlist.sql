-- Waitlist signups for landing page. Run in Supabase SQL Editor if the table doesn't exist.

CREATE TABLE IF NOT EXISTS waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waitlist_email_idx ON waitlist (email);
CREATE INDEX IF NOT EXISTS waitlist_created_at_idx ON waitlist (created_at DESC);

-- RLS: allow insert from anon (for public signup), restrict read to service role
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public to insert waitlist" ON waitlist;
CREATE POLICY "Allow public to insert waitlist" ON waitlist
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can read waitlist" ON waitlist;
CREATE POLICY "Service role can read waitlist" ON waitlist
  FOR SELECT TO service_role USING (true);
