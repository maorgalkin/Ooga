-- ============================================================================
-- CLEAR ZERO INSTALLMENT TOTALS
-- ============================================================================
-- The Cal import used to store Cal's "0 payments" for regular purchases as
-- installment_total = 0. Regular purchases have no installment info.

UPDATE transactions
SET installment_total = NULL
WHERE installment_total = 0
  AND installment_number IS NULL
  AND installment_group_id IS NULL;
