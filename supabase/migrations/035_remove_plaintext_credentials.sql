-- ============================================================================
-- REMOVE PLAINTEXT BANK CREDENTIALS
-- ============================================================================
-- The Add Account form used to save every provider's login fields (including
-- passwords) into bank_connections.metadata as plain text. It now sends them to
-- the import service, which stores them encrypted in credentials_encrypted.
--
-- Wipe the plaintext copies and deactivate those connections; re-add them in
-- the app. Cal fast access (visaCalFast) is untouched: its metadata only holds
-- the ID and last 4 card digits the browser needs to request the SMS code.
--
-- Run AFTER deploying the app version with the new Add Account form.

UPDATE bank_connections
SET metadata = NULL,
    is_active = false
WHERE provider <> 'visaCalFast'
  AND credentials_encrypted IS NULL
  AND metadata IS NOT NULL;
