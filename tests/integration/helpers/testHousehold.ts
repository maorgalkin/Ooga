/**
 * Household Test Helpers
 * ======================
 * 
 * Utilities for testing household-related operations:
 * - Household creation/verification
 * - Member management
 * - Invitation flow
 */

import { getAnonClient, getServiceClient, TEST_PREFIX } from '../setup';

// =============================================================================
// TYPES
// =============================================================================

export interface TestHousehold {
  id: string;
  name: string;
  created_by: string;
}

export interface TestHouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: 'owner' | 'participant';
}

// =============================================================================
// HOUSEHOLD OPERATIONS
// =============================================================================

/**
 * Get the household for the currently authenticated user.
 */
export async function getUserHousehold(): Promise<TestHousehold | null> {
  const client = getAnonClient();
  
  const { data: membership, error: memberError } = await client
    .from('household_members')
    .select('household_id')
    .single();

  if (memberError || !membership) {
    return null;
  }

  const { data: household, error: householdError } = await client
    .from('households')
    .select('*')
    .eq('id', membership.household_id)
    .single();

  if (householdError) {
    throw new Error(`Failed to get household: ${householdError.message}`);
  }

  return household;
}

/**
 * Verify that a user has a household with expected properties.
 */
export async function verifyUserHasHousehold(expectedOwnerId: string): Promise<TestHousehold> {
  const client = getServiceClient();

  // Get household membership
  const { data: membership, error: memberError } = await client
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', expectedOwnerId)
    .single();

  if (memberError || !membership) {
    throw new Error(`User ${expectedOwnerId} has no household membership`);
  }

  // Verify role is owner
  if (membership.role !== 'owner') {
    throw new Error(`User ${expectedOwnerId} is not household owner (role: ${membership.role})`);
  }

  // Get household details
  const { data: household, error: householdError } = await client
    .from('households')
    .select('*')
    .eq('id', membership.household_id)
    .single();

  if (householdError || !household) {
    throw new Error(`Household ${membership.household_id} not found`);
  }

  // Verify created_by
  if (household.created_by !== expectedOwnerId) {
    throw new Error(`Household created_by mismatch: expected ${expectedOwnerId}, got ${household.created_by}`);
  }

  return household;
}

/**
 * Get all members of a household.
 */
export async function getHouseholdMembers(householdId: string): Promise<TestHouseholdMember[]> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('household_members')
    .select('*')
    .eq('household_id', householdId);

  if (error) {
    throw new Error(`Failed to get household members: ${error.message}`);
  }

  return data || [];
}

/**
 * Add a user to a household.
 * Uses service role to bypass invitation flow for testing.
 */
export async function addUserToHousehold(
  householdId: string, 
  userId: string, 
  role: 'participant' = 'participant'
): Promise<void> {
  const client = getServiceClient();

  const { error } = await client
    .from('household_members')
    .insert({
      household_id: householdId,
      user_id: userId,
      role,
      invited_by: userId, // Self-invited for testing
    });

  if (error) {
    throw new Error(`Failed to add user to household: ${error.message}`);
  }

  console.log(`✓ Added user ${userId} to household ${householdId} as ${role}`);
}

/**
 * Remove a user from their household.
 */
export async function removeUserFromHousehold(userId: string): Promise<void> {
  const client = getServiceClient();

  const { error } = await client
    .from('household_members')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to remove user from household: ${error.message}`);
  }
}

/**
 * Count household members.
 */
export async function countHouseholdMembers(householdId: string): Promise<number> {
  const client = getServiceClient();

  const { count, error } = await client
    .from('household_members')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId);

  if (error) {
    throw new Error(`Failed to count household members: ${error.message}`);
  }

  return count || 0;
}
