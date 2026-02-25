ALTER TABLE users ADD COLUMN IF NOT EXISTS tag TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tag ON users(tag) WHERE tag IS NOT NULL;

DO $$
DECLARE
  r RECORD;
  base_tag TEXT;
  candidate TEXT;
  n INT;
BEGIN
  FOR r IN SELECT id, first_name, last_name FROM users WHERE tag IS NULL OR tag = ''
  LOOP
    base_tag := LOWER(REGEXP_REPLACE(TRIM(r.first_name || '-' || r.last_name), '[^a-z0-9-]', '-', 'g'));
    base_tag := REGEXP_REPLACE(base_tag, '-+', '-', 'g');
    base_tag := TRIM(BOTH '-' FROM base_tag);
    IF LENGTH(base_tag) < 2 THEN
      base_tag := 'user-' || SUBSTRING(r.id::text FROM 1 FOR 8);
    END IF;
    candidate := base_tag;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM users WHERE tag = candidate AND id != r.id)
    LOOP
      n := n + 1;
      candidate := base_tag || '-' || n;
    END LOOP;
    UPDATE users SET tag = candidate WHERE id = r.id;
  END LOOP;
END $$;
