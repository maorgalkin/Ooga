-- Migration 025: Multi-Provider Bank Connections
-- Adds bank_connections table for per-user encrypted credentials,
-- and extends transactions with credit-card-specific fields.

-- ─────────────────────────────────────────
-- 1. bank_connections: stores one row per connected bank/card account
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_connections (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id          uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  provider              text NOT NULL
                          CHECK (provider IN (
                            'discount', 'hapoalim', 'leumi', 'mizrahi', 'beinleumi',
                            'union', 'massad', 'mercantile', 'otsarHahayal', 'yahav',
                            'visaCal', 'isracard', 'amex', 'max',
                            'beyahadBishvilha', 'behatsdaa', 'oneZero', 'pagi'
                          )),
  display_name          text,                    -- user-defined label e.g. "My Visa Cal"
  credentials_encrypted text NOT NULL,           -- AES-256-GCM JSON blob (ciphertext+iv+tag)
  last_sync_at          timestamptz,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- RLS: users can only access their own connections
ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bank_connections'
    AND policyname = 'Users can view their own connections'
  ) THEN
    CREATE POLICY "Users can view their own connections"
      ON bank_connections FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bank_connections'
    AND policyname = 'Users can delete their own connections'
  ) THEN
    CREATE POLICY "Users can delete their own connections"
      ON bank_connections FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Scraper service uses service_role and bypasses RLS for insert/update.
-- No client-side insert/update policy needed.

-- ─────────────────────────────────────────
-- 2. Extend transactions with credit-card fields
-- ─────────────────────────────────────────

-- Date the transaction was actually charged/cleared (vs. purchase date)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS processed_date date;

-- Original amount before currency conversion (e.g. $50 USD)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS original_amount numeric;

-- Original currency code (e.g. 'USD', 'EUR', 'ILS')
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS original_currency text;

-- Installment tracking: current installment number (e.g. 2 out of 6)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS installment_number integer;

-- Installment tracking: total number of installments
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS installment_total integer;

-- Extra detail from credit card (e.g. branch name, reference)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS memo text;

-- Which bank_connections row this came from
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS bank_connection_id uuid REFERENCES bank_connections(id) ON DELETE SET NULL;

-- Index for looking up transactions by connection (e.g. "show all Cal transactions")
CREATE INDEX IF NOT EXISTS idx_transactions_bank_connection
  ON transactions (bank_connection_id)
  WHERE bank_connection_id IS NOT NULL;
