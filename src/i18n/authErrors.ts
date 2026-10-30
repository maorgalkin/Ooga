import type { AuthError } from '@supabase/supabase-js';
import type { TFunction } from 'i18next';

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'auth.errors.invalidCredentials',
  email_not_confirmed: 'auth.errors.emailNotConfirmed',
  user_already_exists: 'auth.errors.userExists',
  email_exists: 'auth.errors.userExists',
  weak_password: 'auth.errors.weakPassword',
  over_request_rate_limit: 'auth.errors.rateLimited',
  over_email_send_rate_limit: 'auth.errors.rateLimited',
};

/**
 * A sentence for a Supabase auth error in the reader's language. Supabase's own messages are
 * English and technical, so they're logged, never shown.
 */
export function authErrorMessage(error: AuthError, t: TFunction, fallbackKey: string): string {
  const key = error.code ? BY_CODE[error.code] : undefined;
  if (!key) console.error('Auth error:', error.code ?? error.status, error.message);
  return t(key ?? fallbackKey);
}
