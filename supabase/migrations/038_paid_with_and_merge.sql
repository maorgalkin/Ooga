-- ============================================================================
-- "PAID WITH" + MERGING BANK ROWS INTO MANUAL ENTRIES
-- ============================================================================
-- A manual entry can say which connected account paid for it. Until the bank
-- import brings the real charge, it's a placeholder ("awaiting bank"). When the
-- import finds it, the bank row is merged into the entry: the entry keeps its
-- category, family member and description and takes the bank's amount, date and
-- import keys; the bank row is removed. A snapshot of both allows an exact undo.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS paid_with_connection_id uuid REFERENCES bank_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merge_snapshot jsonb; -- {"entry": <row before merge>, "bank_row": <removed bank row>}

COMMENT ON COLUMN transactions.paid_with_connection_id IS 'Manual entries: the connected account that paid (null = cash / not connected)';
COMMENT ON COLUMN transactions.merge_snapshot IS 'Set when a bank row was merged into this manual entry; used to undo the merge';

-- Placeholders awaiting their bank row
CREATE INDEX IF NOT EXISTS idx_transactions_awaiting_bank
  ON transactions (household_id, paid_with_connection_id, date)
  WHERE source = 'manual' AND paid_with_connection_id IS NOT NULL;

-- ── Merge a bank row into a manual entry ────────────────────────────────────
CREATE OR REPLACE FUNCTION merge_bank_transaction(p_entry_id uuid, p_bank_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  entry transactions;
  bank  transactions;
BEGIN
  SELECT * INTO entry FROM transactions WHERE id = p_entry_id FOR UPDATE;
  SELECT * INTO bank  FROM transactions WHERE id = p_bank_id  FOR UPDATE;

  IF entry.id IS NULL OR bank.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;
  IF entry.household_id IS DISTINCT FROM bank.household_id OR NOT user_is_in_household(entry.household_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF entry.source <> 'manual' OR bank.source <> 'bank_import' OR entry.type <> bank.type THEN
    RAISE EXCEPTION 'Only a bank row can be merged into a manual entry of the same type';
  END IF;

  -- Remove the bank row first: the entry takes over its import keys (unique per household)
  DELETE FROM transactions WHERE id = bank.id;

  UPDATE transactions SET
    merge_snapshot      = jsonb_build_object('entry', to_jsonb(entry), 'bank_row', to_jsonb(bank)),
    source              = 'bank_import',
    date                = bank.date,
    amount              = bank.amount,
    status              = bank.status,
    processed_date      = bank.processed_date,
    original_amount     = bank.original_amount,
    original_currency   = bank.original_currency,
    dedupe_hash         = bank.dedupe_hash,
    external_id         = bank.external_id,
    bank_connection_id  = bank.bank_connection_id,
    bank_account_number = bank.bank_account_number,
    bank_card_last4     = bank.bank_card_last4,
    installment_number  = COALESCE(entry.installment_number, bank.installment_number),
    installment_total   = COALESCE(entry.installment_total, bank.installment_total),
    memo                = concat_ws(' | ', NULLIF(entry.memo, ''), 'Bank: ' || bank.description, NULLIF(bank.memo, '')),
    updated_at          = now()
  WHERE id = entry.id;
END;
$$;

-- ── Undo a merge: restore the entry and the bank row exactly as they were ───
CREATE OR REPLACE FUNCTION unmerge_bank_transaction(p_entry_id uuid)
RETURNS uuid -- the restored bank row's id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  merged transactions;
  entry  transactions;
  bank   transactions;
BEGIN
  SELECT * INTO merged FROM transactions WHERE id = p_entry_id FOR UPDATE;

  IF merged.id IS NULL OR merged.merge_snapshot IS NULL THEN
    RAISE EXCEPTION 'Nothing to undo';
  END IF;
  IF NOT user_is_in_household(merged.household_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  entry := jsonb_populate_record(NULL::transactions, merged.merge_snapshot->'entry');
  bank  := jsonb_populate_record(NULL::transactions, merged.merge_snapshot->'bank_row');

  DELETE FROM transactions WHERE id = merged.id;
  INSERT INTO transactions SELECT entry.*;
  INSERT INTO transactions SELECT bank.*;
  RETURN bank.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION merge_bank_transaction(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION unmerge_bank_transaction(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION merge_bank_transaction(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION unmerge_bank_transaction(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
