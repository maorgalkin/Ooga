-- Migration 028: Make household_id nullable on bank_connections
-- household_id was NOT NULL but isn't used functionally — it was blocking
-- connection creation for users whose household lookup fails (e.g., not in
-- household_members, or PostgREST single-row Accept returning 406).
-- A bank connection belongs to a user; the household can be derived if needed.

ALTER TABLE bank_connections
  ALTER COLUMN household_id DROP NOT NULL;
