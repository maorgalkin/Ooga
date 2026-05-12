-- Adds bank_card_last4 to transactions for credit card source tracking.
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS bank_card_last4 text;
