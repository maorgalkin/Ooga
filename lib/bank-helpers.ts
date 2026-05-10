import { getAdminClient } from './supabase-admin';
import { decrypt } from './crypto-utils';

export async function loadCredentials(
  connectionId: string,
  userId: string
): Promise<Record<string, string>> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('bank_connections')
    .select('credentials_encrypted')
    .eq('id', connectionId)
    .eq('user_id', userId)
    .single();

  if (error || !data) throw new Error('Connection not found');
  return JSON.parse(decrypt((data as Record<string, string>).credentials_encrypted)) as Record<string, string>;
}
