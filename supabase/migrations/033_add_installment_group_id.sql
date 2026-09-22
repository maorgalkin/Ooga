-- ============================================================================
-- ADD INSTALLMENT GROUP ID
-- ============================================================================
-- 20251206_add_installments.sql was never applied in production, while
-- 025_bank_connections.sql already added installment_number/installment_total
-- (bank imports set these without a group). This adds the missing group column
-- with a constraint that tolerates bank-imported rows: a group requires a
-- number and total, but a number/total does not require a group.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS installment_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_transactions_installment_group
  ON transactions(installment_group_id)
  WHERE installment_group_id IS NOT NULL;

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS check_installment_consistency;

ALTER TABLE transactions
  ADD CONSTRAINT check_installment_consistency
  CHECK (
    installment_group_id IS NULL
    OR (installment_number IS NOT NULL AND installment_total IS NOT NULL)
  );

COMMENT ON COLUMN transactions.installment_group_id IS 'UUID linking all transactions in an installment series created in-app';

-- Refresh PostgREST's schema cache so the API sees the new column immediately
NOTIFY pgrst, 'reload schema';
