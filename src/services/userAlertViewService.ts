import { supabase } from '../lib/supabase';

// Which budget alerts each person has seen, stored per user (user_alert_views) so it follows
// them to every device. The keys come from budgetAlertKey in hooks/useBudgetAlerts.

/** The alert keys this person has seen. */
export async function getSeenAlertKeys(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('user_alert_views').select('alert_id').eq('user_id', userId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row: { alert_id: string }) => row.alert_id));
}

/** Records that this person has seen these alerts; seeing one again is harmless. */
export async function markAlertsSeen(userId: string, keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  const { data: membership, error: membershipError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw new Error(membershipError.message);
  if (!membership?.household_id) throw new Error('Not in a household');

  const { error } = await supabase.from('user_alert_views').upsert(
    keys.map((alert_id) => ({ user_id: userId, alert_id, household_id: membership.household_id })),
    { onConflict: 'user_id,alert_id', ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

/** Forgets every alert this person has seen (the Dashboard's development-only reset). */
export async function clearSeenAlerts(userId: string): Promise<void> {
  const { error } = await supabase.from('user_alert_views').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
}
