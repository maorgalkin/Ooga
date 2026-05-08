-- Migration 026: Link transactions back to their import session
-- Enables the post-import review step: "fetch all transactions from session X".

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS import_session_id uuid
    REFERENCES bank_import_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_import_session
  ON transactions (import_session_id)
  WHERE import_session_id IS NOT NULL;
