-- Migration 032: Allow authenticated users to manage their own bank connections
-- Previously, INSERT/UPDATE were done via a Vercel serverless function using the service role.
-- Now that /api/connections is removed and imports run fully client-side, users need
-- direct RLS-protected access to create and update their own connection rows.

-- credentials_encrypted was NOT NULL but is no longer populated for client-side
-- visaCalFast connections (credentials live in metadata.id / metadata.last4Digits).
-- Make it nullable so direct INSERT from the browser can omit it.
ALTER TABLE bank_connections ALTER COLUMN credentials_encrypted DROP NOT NULL;

-- INSERT: users can create connections for themselves
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bank_connections'
    AND policyname = 'Users can insert their own bank connections'
  ) THEN
    CREATE POLICY "Users can insert their own bank connections"
      ON bank_connections FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- UPDATE: users can update their own connections (e.g. last_sync_at, metadata)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bank_connections'
    AND policyname = 'Users can update their own bank connections'
  ) THEN
    CREATE POLICY "Users can update their own bank connections"
      ON bank_connections FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Note: SELECT and DELETE policies already exist from migration 025.
