-- Migration 027: Add visaCalFast provider to bank_connections CHECK constraint
-- Supports the Visa Cal "fast access" login (ID + last 4 card digits + OTP)

ALTER TABLE bank_connections DROP CONSTRAINT bank_connections_provider_check;

ALTER TABLE bank_connections
  ADD CONSTRAINT bank_connections_provider_check
  CHECK (provider IN (
    'discount', 'hapoalim', 'leumi', 'mizrahi', 'beinleumi',
    'union', 'massad', 'mercantile', 'otsarHahayal', 'yahav',
    'visaCal', 'visaCalFast', 'isracard', 'amex', 'max',
    'beyahadBishvilha', 'behatsdaa', 'oneZero', 'pagi'
  ));
