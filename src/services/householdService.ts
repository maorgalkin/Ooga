import { supabase } from '../lib/supabase';

export interface Household {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: 'owner' | 'participant';
  joined_at: string;
  invited_by: string | null;
  email?: string;  // Added from auth.users join
}

// Helper to get current user ID
const getCurrentUserId = async (): Promise<string> => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('User not authenticated');
  }
  return user.id;
};

// ==================== HOUSEHOLD QUERIES ====================

/**
 * Get the current user's household
 */
export const getUserHousehold = async (): Promise<Household | null> => {
  const userId = await getCurrentUserId();

  // First get the household_id from household_members
  const { data: memberData, error: memberError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .single();

  if (memberError || !memberData) {
    return null;
  }

  // Then get the household details
  const { data, error } = await supabase
    .from('households')
    .select('*')
    .eq('id', memberData.household_id)
    .single();

  if (error) {
    console.error('Error fetching household:', error);
    throw error;
  }

  return data;
};

/**
 * Get all members of the current user's household
 */
export const getHouseholdMembers = async (): Promise<HouseholdMember[]> => {
  const userId = await getCurrentUserId();

  // First get the user's household_id
  const { data: memberData, error: memberError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .single();

  if (memberError || !memberData) {
    return [];
  }

  // Get all members of this household with emails using RPC
  const { data, error } = await supabase
    .rpc('get_household_members_with_emails', {
      p_household_id: memberData.household_id
    });

  if (error) {
    console.error('Error fetching household members:', error);
    throw error;
  }

  // Cast role from TEXT back to the proper type
  return (data || []).map((member: any) => ({
    ...member,
    role: member.role as 'owner' | 'participant',
  }));
};

/**
 * Get current user's role in their household
 */
export const getUserRole = async (): Promise<'owner' | 'participant' | null> => {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('household_members')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.role;
};

// ==================== HOUSEHOLD MUTATIONS ====================

/**
 * Create a new household (typically only called during user registration)
 */
export const createHousehold = async (name: string): Promise<Household> => {
  const userId = await getCurrentUserId();

  // Create the household
  const { data: household, error: householdError } = await supabase
    .from('households')
    .insert({
      name,
      created_by: userId,
    })
    .select()
    .single();

  if (householdError) {
    console.error('Error creating household:', householdError);
    throw householdError;
  }

  // Add creator as owner
  const { error: memberError } = await supabase
    .from('household_members')
    .insert({
      household_id: household.id,
      user_id: userId,
      role: 'owner',
    });

  if (memberError) {
    console.error('Error adding household owner:', memberError);
    throw memberError;
  }

  return household;
};

/**
 * Update household name
 */
export const updateHouseholdName = async (householdId: string, name: string): Promise<Household> => {
  const { data, error } = await supabase
    .from('households')
    .update({ name })
    .eq('id', householdId)
    .select()
    .single();

  if (error) {
    console.error('Error updating household name:', error);
    throw error;
  }

  return data;
};

/**
 * Invite a member by their user ID (for testing/development)
 * Note: This function is deprecated. Use invitation codes instead.
 */
export const inviteMemberByUserId = async (
  inviteeUserId: string, 
  role: 'participant' = 'participant'
): Promise<HouseholdMember> => {
  const userId = await getCurrentUserId();

  // Get the inviter's household
  const { data: memberData, error: memberError } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', userId)
    .single();

  if (memberError || !memberData) {
    throw new Error('User is not part of a household');
  }

  // Check if inviter has permission (owner only for now, or could allow participants)
  if (memberData.role !== 'owner') {
    throw new Error('Only owners can invite members');
  }

  // Add the new member
  const { data, error } = await supabase
    .from('household_members')
    .insert({
      household_id: memberData.household_id,
      user_id: inviteeUserId,
      role,
      invited_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding household member:', error);
    throw error;
  }

  return data;
};

/**
 * Remove a member from the household
 */
export const removeMember = async (memberId: string): Promise<void> => {
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('id', memberId);

  if (error) {
    console.error('Error removing household member:', error);
    throw error;
  }
};

/**
 * Leave the current household
 */
export const leaveHousehold = async (): Promise<void> => {
  const userId = await getCurrentUserId();

  // Get user's membership
  const { data: memberData, error: memberError } = await supabase
    .from('household_members')
    .select('role, household_id')
    .eq('user_id', userId)
    .single();

  if (memberError || !memberData) {
    throw new Error('User is not part of a household');
  }

  // Prevent owner from leaving (must transfer ownership first)
  if (memberData.role === 'owner') {
    throw new Error('Owner cannot leave household. Transfer ownership first or delete the household.');
  }

  // Remove the member
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('user_id', userId);

  if (error) {
    console.error('Error leaving household:', error);
    throw error;
  }
};

/**
 * Delete a household (only owner can do this)
 * WARNING: This deletes ALL household data including budgets, transactions, etc.
 * After deletion, a new empty household is automatically created for the user
 * unless skipAutoCreate is true (used when joining another household).
 * 
 * @param householdId - The household to delete
 * @param skipAutoCreate - If true, don't auto-create a new household (caller will handle it)
 * @returns The new household if created, or null if skipped
 */
export const deleteHousehold = async (
  householdId: string, 
  skipAutoCreate: boolean = false
): Promise<Household | null> => {
  const userId = await getCurrentUserId();

  // Verify user is the owner
  const { data: memberData, error: memberError } = await supabase
    .from('household_members')
    .select('role')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .single();

  if (memberError || !memberData) {
    throw new Error('User is not a member of this household');
  }

  if (memberData.role !== 'owner') {
    throw new Error('Only the household owner can delete the household');
  }

  // Delete the household (CASCADE will delete all related data including household_members)
  const { error } = await supabase
    .from('households')
    .delete()
    .eq('id', householdId);

  if (error) {
    console.error('Error deleting household:', error);
    throw error;
  }

  // Create a new household for the user so they're not left in a broken state
  // Unless caller explicitly opts out (e.g., when joining another household)
  if (!skipAutoCreate) {
    const newHousehold = await createHousehold('My Household');
    return newHousehold;
  }
  
  return null;
};

/**
 * Check if user is the sole owner of their household (auto-created scenario)
 */
export const isUserSoleOwner = async (): Promise<boolean> => {
  const userId = await getCurrentUserId();

  // Get user's household membership
  const { data: memberData, error: memberError } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', userId)
    .single();

  if (memberError || !memberData) {
    return false;
  }

  // Check if user is owner
  if (memberData.role !== 'owner') {
    return false;
  }

  // Count total members in this household
  const { count, error: countError } = await supabase
    .from('household_members')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', memberData.household_id);

  if (countError) {
    console.error('Error counting household members:', countError);
    return false;
  }

  // Return true if user is the only member
  return count === 1;
};

/**
 * Accept an invitation and join another household
 * If user owns their current household (auto-created), it will be deleted
 * WARNING: This may result in data loss
 */
export const acceptInvitationAndJoin = async (
  invitationCode: string,
  deleteCurrentHousehold: boolean = false
): Promise<{
  success: boolean;
  willDeleteData: boolean;
  householdName?: string;
  error?: string;
}> => {
  const userId = await getCurrentUserId();

  try {
    // Decode invitation code (format: base64 of "householdId:inviterUserId")
    const decoded = atob(invitationCode);
    const [targetHouseholdId, inviterUserId] = decoded.split(':');

    if (!targetHouseholdId || !inviterUserId) {
      return { success: false, willDeleteData: false, error: 'Invalid invitation code' };
    }

    // Get target household info
    const { data: targetHousehold, error: householdError } = await supabase
      .from('households')
      .select('name')
      .eq('id', targetHouseholdId)
      .single();

    if (householdError || !targetHousehold) {
      return { success: false, willDeleteData: false, error: 'Household not found' };
    }

    // Get user's current household membership
    const { data: currentMember } = await supabase
      .from('household_members')
      .select('household_id, role')
      .eq('user_id', userId)
      .single();

    const isSoleOwner = await isUserSoleOwner();

    // If user owns their current household and hasn't confirmed deletion, return warning
    if (isSoleOwner && !deleteCurrentHousehold) {
      return {
        success: false,
        willDeleteData: true,
        householdName: targetHousehold.name,
        error: 'You will lose all your current household data. Please confirm to proceed.'
      };
    }

    // Delete current household if user is sole owner
    if (isSoleOwner && currentMember) {
      await deleteHousehold(currentMember.household_id, true); // skipAutoCreate - joining another household
    } else if (currentMember) {
      // Just leave the household if not owner
      await leaveHousehold();
    }

    // Join the new household
    const { error: joinError } = await supabase
      .from('household_members')
      .insert({
        household_id: targetHouseholdId,
        user_id: userId,
        role: 'participant',
        invited_by: inviterUserId,
      });

    if (joinError) {
      console.error('Error joining household:', joinError);
      return { success: false, willDeleteData: false, error: 'Failed to join household' };
    }

    return { success: true, willDeleteData: isSoleOwner, householdName: targetHousehold.name };
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return { success: false, willDeleteData: false, error: 'Invalid invitation code or expired' };
  }
};

/**
 * Generate an invitation code for the current household
 * Returns a base64 encoded string: "householdId:inviterUserId"
 */
export const generateInvitationCode = async (): Promise<string> => {
  const userId = await getCurrentUserId();

  // Get user's household
  const { data: memberData, error: memberError } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', userId)
    .single();

  if (memberError || !memberData) {
    throw new Error('User is not part of a household');
  }

  // Check if user has permission to invite (owner or participant can both invite)
  if (memberData.role !== 'owner' && memberData.role !== 'participant') {
    throw new Error('Only household members can generate invitation codes');
  }

  // Create invitation code: base64 of "householdId:userId"
  const code = btoa(`${memberData.household_id}:${userId}`);
  
  return code;
};

/**
 * Leave current household and create a new personal household
 * This allows users to "start fresh" with their own household
 */
export const leaveAndCreateNewHousehold = async (
  newHouseholdName?: string
): Promise<Household> => {
  const userId = await getCurrentUserId();

  // Get user's current household info
  const { data: currentMember, error: memberError } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', userId)
    .single();

  if (memberError || !currentMember) {
    throw new Error('User is not part of a household');
  }

  // Get user's first name for default household name
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  const firstName = user.user_metadata?.first_name || 
                    user.user_metadata?.full_name?.split(' ')[0] || 
                    'My';

  const householdName = newHouseholdName || `${firstName}'s Household`;

  // If user is owner, delete the household (CASCADE handles members)
  if (currentMember.role === 'owner') {
    await deleteHousehold(currentMember.household_id, true); // skipAutoCreate - creating with custom name
  } else {
    // If member/admin, just leave
    await leaveHousehold();
  }

  // Create new personal household with the user's preferred name
  const newHousehold = await createHousehold(householdName);

  return newHousehold;
};

/**
 * Update a member's role
 * Note: This function is deprecated - only owner/participant roles exist now
 */
export const updateMemberRole = async (
  memberId: string, 
  newRole: 'participant'
): Promise<HouseholdMember> => {
  const { data, error } = await supabase
    .from('household_members')
    .update({ role: newRole })
    .eq('id', memberId)
    .select()
    .single();

  if (error) {
    console.error('Error updating member role:', error);
    throw error;
  }

  return data;
};

/**
 * Transfer ownership to another household member
 * The current owner becomes a participant
 */
export const transferOwnership = async (newOwnerId: string): Promise<void> => {
  const userId = await getCurrentUserId();

  // Get current owner's membership
  const { data: currentOwner, error: ownerError } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', userId)
    .single();

  if (ownerError || !currentOwner) {
    throw new Error('User is not part of a household');
  }

  // Verify current user is owner
  if (currentOwner.role !== 'owner') {
    throw new Error('Only the household owner can transfer ownership');
  }

  // Get new owner's membership
  const { data: newOwner, error: newOwnerError } = await supabase
    .from('household_members')
    .select('id, household_id, role')
    .eq('id', newOwnerId)
    .single();

  if (newOwnerError || !newOwner) {
    throw new Error('New owner not found');
  }

  // Verify new owner is in the same household
  if (newOwner.household_id !== currentOwner.household_id) {
    throw new Error('New owner must be a member of the same household');
  }

  // Verify new owner is not already owner
  if (newOwner.role === 'owner') {
    throw new Error('User is already the owner');
  }

  // Use a transaction-like approach:
  // 1. Demote current owner to participant
  const { error: demoteError } = await supabase
    .from('household_members')
    .update({ role: 'participant' })
    .eq('user_id', userId);

  if (demoteError) {
    console.error('Error demoting current owner:', demoteError);
    throw new Error('Failed to transfer ownership');
  }

  // 2. Promote new member to owner
  const { error: promoteError } = await supabase
    .from('household_members')
    .update({ role: 'owner' })
    .eq('id', newOwnerId);

  if (promoteError) {
    console.error('Error promoting new owner:', promoteError);
    // Try to rollback by re-promoting original owner
    await supabase
      .from('household_members')
      .update({ role: 'owner' })
      .eq('user_id', userId);
    throw new Error('Failed to transfer ownership');
  }
};
