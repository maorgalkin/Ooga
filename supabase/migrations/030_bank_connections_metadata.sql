-- Add metadata column to bank_connections for non-sensitive identifier data
-- (e.g. national ID used as Cal login username, last 4 digits of card)
-- This allows the browser to read these identifiers without server-side decryption.
ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS metadata jsonb;
