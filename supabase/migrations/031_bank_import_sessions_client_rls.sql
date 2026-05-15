-- Migration 031: Allow authenticated users to manage their own import sessions
-- Previously, only service_role (server-side scraper) could insert/update sessions.
-- Now that imports run client-side (calDirectService.ts), the user's JWT must be
-- able to create and update their own session rows.

CREATE POLICY "Users can insert their own import sessions"
  ON bank_import_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own import sessions"
  ON bank_import_sessions FOR UPDATE
  USING (auth.uid() = user_id);
