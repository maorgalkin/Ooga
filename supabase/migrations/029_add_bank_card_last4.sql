-- Adds missing columns for bank import transaction rows.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS bank_card_last4 text;
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS dedupe_hash text;
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed';

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_dedupe_hash
  ON transactions(household_id, dedupe_hash)
  WHERE dedupe_hash IS NOT NULL;
