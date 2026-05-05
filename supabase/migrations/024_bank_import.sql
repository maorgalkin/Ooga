-- Migration 024: Bank Import Support
-- Adds fields to transactions for bank imports and creates bank_import_sessions table.

-- Add source tracking to transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'bank_import'));

-- Add external_id for deduplication (hash of date+amount+description)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS external_id text;

-- Index for fast dedup lookups
CREATE INDEX IF NOT EXISTS idx_transactions_external_id
  ON transactions (user_id, external_id)
  WHERE external_id IS NOT NULL;

-- Add bank account number for reference
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS bank_account_number text;

-- Table to track bank import sessions
CREATE TABLE IF NOT EXISTS bank_import_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id  uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'logging_in', 'awaiting_otp', 'importing', 'complete', 'error')),
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  date_range_start  date,
  date_range_end    date,
  transactions_imported  integer NOT NULL DEFAULT 0,
  transactions_skipped   integer NOT NULL DEFAULT 0,
  error_message          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- RLS for bank_import_sessions
ALTER TABLE bank_import_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own import sessions"
  ON bank_import_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- The scraper service uses service_role key and bypasses RLS for inserts.
-- Users cannot directly insert/update sessions from the client.
