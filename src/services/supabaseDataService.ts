import { supabase } from '../lib/supabase';
import type { 
  Transaction, 
  FamilyMember
} from '../types';

// Helper to get category_id from category name
const getCategoryId = async (categoryName: string, userId: string): Promise<string | null> => {
  if (!categoryName) return null;
  
  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .eq('name', categoryName)
    .is('deleted_at', null)
    .single();
  
  return data?.id || null;
};

// Helper to get current user ID
const getCurrentUserId = async (): Promise<string> => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('User not authenticated');
  }
  return user.id;
};

// Helper to get current user's household ID
const getHouseholdId = async (): Promise<string> => {
  const userId = await getCurrentUserId();
  
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new Error('User is not part of a household');
  }

  return data.household_id;
};

// ==================== TRANSACTIONS ====================

export const getTransactions = async (): Promise<Transaction[]> => {
  const householdId = await getHouseholdId();
  
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('household_id', householdId)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }

  return data.map(row => ({
    id: row.id,
    date: row.date,
    description: row.description,
    amount: parseFloat(row.amount),
    category: row.category,
    type: row.type as 'income' | 'expense',
    familyMember: row.family_member_id || undefined,
    installment_group_id: row.installment_group_id || undefined,
    installment_number: row.installment_number || undefined,
    installment_total: row.installment_total || undefined,
  }));
};

export const addTransaction = async (transaction: Omit<Transaction, 'id'>): Promise<Transaction> => {
  const userId = await getCurrentUserId();
  const householdId = await getHouseholdId();
  
  // Look up category_id from category name
  const categoryId = await getCategoryId(transaction.category, userId);

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      household_id: householdId,
      date: transaction.date,
      description: transaction.description,
      amount: transaction.amount,
      category: transaction.category,
      category_id: categoryId,
      type: transaction.type,
      family_member_id: transaction.familyMember || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to add transaction: ${error.message}`);
  }

  return {
    id: data.id,
    date: data.date,
    description: data.description,
    amount: parseFloat(data.amount),
    category: data.category,
    type: data.type as 'income' | 'expense',
    familyMember: data.family_member_id || undefined,
  };
};

export const updateTransaction = async (id: string, transaction: Omit<Transaction, 'id'>): Promise<Transaction> => {
  const userId = await getCurrentUserId();
  const householdId = await getHouseholdId();
  
  // Look up category_id from category name
  const categoryId = await getCategoryId(transaction.category, userId);

  const { data, error } = await supabase
    .from('transactions')
    .update({
      date: transaction.date,
      description: transaction.description,
      amount: transaction.amount,
      category: transaction.category,
      category_id: categoryId,
      type: transaction.type,
      family_member_id: transaction.familyMember || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('household_id', householdId) // Ensure user can only update household transactions
    .select()
    .single();

  if (error) {
    console.error('Error updating transaction:', error);
    throw error;
  }

  return {
    id: data.id,
    date: data.date,
    description: data.description,
    amount: parseFloat(data.amount),
    category: data.category,
    type: data.type as 'income' | 'expense',
    familyMember: data.family_member_id || undefined,
  };
};

export const deleteTransaction = async (id: string): Promise<void> => {
  // Remember bank-imported rows deleted on purpose, so a later import doesn't bring them back.
  // (Rows unticked in the import review use bankImportService.deleteTransactions instead.)
  const { data: row } = await supabase
    .from('transactions')
    .select('household_id, dedupe_hash, external_id, date, description, amount')
    .eq('id', id)
    .maybeSingle();
  const importKey = row?.dedupe_hash ?? row?.external_id;
  if (row && importKey) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error: tombstoneError } = await supabase.from('import_tombstones').upsert(
      {
        household_id: row.household_id,
        import_key: importKey,
        date: row.date,
        description: row.description,
        amount: row.amount,
        deleted_by: user?.id ?? null,
      },
      { onConflict: 'household_id,import_key', ignoreDuplicates: true }
    );
    // Never block the deletion itself (e.g. before migration 036 creates the table)
    if (tombstoneError) console.warn('Could not record deleted import:', tombstoneError.message);
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);
    // Note: RLS policy allows household members to delete any household transaction
    // Don't filter by user_id - that would prevent deleting other household members' transactions

  if (error) {
    console.error('Error deleting transaction:', error);
    throw error;
  }
};

// ==================== INSTALLMENTS ====================

/**
 * Split a total into equal installments rounded to the cent.
 * Leftover cents go on the first installment so the parts always sum to the total.
 */
export const splitInstallmentAmounts = (total: number, numberOfInstallments: number): number[] => {
  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / numberOfInstallments);
  const remainderCents = totalCents - baseCents * numberOfInstallments;
  return Array.from({ length: numberOfInstallments }, (_, i) =>
    (i === 0 ? baseCents + remainderCents : baseCents) / 100
  );
};

export const addInstallmentTransactions = async (
  transaction: Omit<Transaction, 'id'>,
  numberOfInstallments: number,
  amounts?: number[] // Per-installment amounts; defaults to transaction.amount for each
): Promise<Transaction[]> => {
  const userId = await getCurrentUserId();
  const householdId = await getHouseholdId();
  const categoryId = await getCategoryId(transaction.category, userId);
  
  // Generate a unique group ID for this installment series
  const installmentGroupId = crypto.randomUUID();
  
  // Create all installment transactions
  const installments = [];
  const baseDate = new Date(transaction.date + 'T00:00:00'); // Ensure local timezone
  
  for (let i = 0; i < numberOfInstallments; i++) {
    // First installment keeps the original date; the rest fall on the 1st of each following month
    const installmentDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
    // Format as YYYY-MM-DD in local timezone (avoid toISOString timezone issues)
    const dateString = i === 0
      ? transaction.date
      : `${installmentDate.getFullYear()}-${String(installmentDate.getMonth() + 1).padStart(2, '0')}-01`;
    
    installments.push({
      user_id: userId,
      household_id: householdId,
      date: dateString,
      description: `${transaction.description} [${i + 1}/${numberOfInstallments}]`,
      amount: amounts?.[i] ?? transaction.amount,
      category: transaction.category,
      category_id: categoryId,
      type: transaction.type,
      family_member_id: transaction.familyMember || null,
      installment_group_id: installmentGroupId,
      installment_number: i + 1,
      installment_total: numberOfInstallments,
    });
  }
  
  const { data, error } = await supabase
    .from('transactions')
    .insert(installments)
    .select();
  
  if (error) {
    throw new Error(`Failed to add installment transactions: ${error.message}`);
  }
  
  return data.map(row => ({
    id: row.id,
    date: row.date,
    description: row.description,
    amount: parseFloat(row.amount),
    category: row.category,
    type: row.type as 'income' | 'expense',
    familyMember: row.family_member_id || undefined,
    installment_group_id: row.installment_group_id,
    installment_number: row.installment_number,
    installment_total: row.installment_total,
  }));
};

export const deleteInstallmentGroup = async (installmentGroupId: string): Promise<void> => {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('installment_group_id', installmentGroupId);
  
  if (error) {
    console.error('Error deleting installment group:', error);
    throw error;
  }
};

export const deleteFutureInstallments = async (
  installmentGroupId: string,
  fromInstallmentNumber: number
): Promise<void> => {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('installment_group_id', installmentGroupId)
    .gte('installment_number', fromInstallmentNumber);
  
  if (error) {
    console.error('Error deleting future installments:', error);
    throw error;
  }
};

export const getInstallmentGroupTransactions = async (
  installmentGroupId: string
): Promise<Transaction[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('installment_group_id', installmentGroupId)
    .order('installment_number', { ascending: true });
  
  if (error) {
    console.error('Error fetching installment group:', error);
    throw error;
  }
  
  return data.map(row => ({
    id: row.id,
    date: row.date,
    description: row.description,
    amount: parseFloat(row.amount),
    category: row.category,
    type: row.type as 'income' | 'expense',
    familyMember: row.family_member_id || undefined,
    installment_group_id: row.installment_group_id,
    installment_number: row.installment_number,
    installment_total: row.installment_total,
  }));
};

// ==================== FAMILY MEMBERS ====================

export const getFamilyMembers = async (): Promise<FamilyMember[]> => {
  const householdId = await getHouseholdId();

  const { data, error } = await supabase
    .from('family_members')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching family members:', error);
    throw error;
  }

  return data.map(row => ({
    id: row.id,
    name: row.name,
    color: row.color,
    household_member_id: row.household_member_id,
  }));
};

export const addFamilyMember = async (member: Omit<FamilyMember, 'id'>): Promise<FamilyMember> => {
  const userId = await getCurrentUserId();
  const householdId = await getHouseholdId();

  const { data, error } = await supabase
    .from('family_members')
    .insert({
      user_id: userId,
      household_id: householdId,
      name: member.name,
      color: member.color,
      household_member_id: member.household_member_id,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding family member:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    color: data.color,
    household_member_id: data.household_member_id,
  };
};

export const updateFamilyMember = async (id: string, member: Omit<FamilyMember, 'id'>): Promise<FamilyMember> => {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('family_members')
    .update({
      name: member.name,
      color: member.color,
      household_member_id: member.household_member_id,
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating family member:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    color: data.color,
    household_member_id: data.household_member_id,
  };
};

export const deleteFamilyMember = async (id: string): Promise<void> => {
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting family member:', error);
    throw error;
  }
};
