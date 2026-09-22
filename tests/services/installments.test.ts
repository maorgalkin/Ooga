import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as SupabaseService from '../../src/services/supabaseDataService';
import { supabase } from '../../src/lib/supabase';

// Mock Supabase client
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

// Mock crypto.randomUUID
const mockUUID = 'test-uuid-12345';
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => mockUUID),
});

// Helper to create a mock Supabase query chain
const createMockChain = (finalResult: any) => {
  const chain: any = {};
  
  const resultWithChain = {
    ...finalResult,
    then: (resolve: any) => Promise.resolve(finalResult).then(resolve),
    catch: (reject: any) => Promise.resolve(finalResult).catch(reject),
  };
  
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(resultWithChain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  
  chain.single = vi.fn().mockResolvedValue(finalResult);
  chain.maybeSingle = vi.fn().mockResolvedValue(finalResult);
  
  chain.then = resultWithChain.then;
  chain.catch = resultWithChain.catch;
  
  return chain;
};

describe('Installments Feature', () => {
  const mockUserId = 'test-user-123';
  const mockHouseholdId = 'test-household-123';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock getUser to return test user
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: mockUserId } as any },
      error: null,
    });
    
    // Mock household_members query for getHouseholdId
    const householdMockResult = { 
      data: { household_id: mockHouseholdId }, 
      error: null 
    };
    const householdMockChain = createMockChain(householdMockResult);
    
    // Default mock for from('transactions')
    const transactionMockResult = { data: [], error: null };
    const transactionMockChain = createMockChain(transactionMockResult);
    
    // Setup default mocking - will be overridden in specific tests
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'household_members') {
        return householdMockChain as any;
      }
      if (table === 'categories') {
        // Mock category lookup
        const categoryResult = { 
          data: { id: 'cat-123', name: 'Test Category' }, 
          error: null 
        };
        return createMockChain(categoryResult) as any;
      }
      return transactionMockChain as any;
    });
  });

  describe('addInstallmentTransactions', () => {
    it('should create multiple transactions with installment fields', async () => {
      // Arrange
      const transactionData = {
        type: 'expense' as const,
        description: 'Gym Membership',
        amount: 50,
        category: 'Health',
        date: '2025-12-15',
      };
      const numberOfInstallments = 3;

      const mockResult = { data: [], error: null };
      const mockChain = createMockChain(mockResult);
      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      // Act
      const result = await SupabaseService.addInstallmentTransactions(
        transactionData,
        numberOfInstallments
      );

      // Assert
      expect(supabase.from).toHaveBeenCalledWith('transactions');
      expect(mockChain.insert).toHaveBeenCalled();
      
      const insertedData = mockChain.insert.mock.calls[0][0];
      expect(insertedData).toHaveLength(3);
      
      // Check first installment
      expect(insertedData[0]).toMatchObject({
        description: 'Gym Membership [1/3]',
        amount: 50,
        category: 'Health',
        installment_group_id: mockUUID,
        installment_number: 1,
        installment_total: 3,
      });
      
      // First installment keeps the original date, the rest are on the 1st
      expect(insertedData[0].date).toBe('2025-12-15');
      expect(insertedData[1].date).toBe('2026-01-01');
      
      // Check second installment
      expect(insertedData[1]).toMatchObject({
        description: 'Gym Membership [2/3]',
        installment_number: 2,
        installment_total: 3,
      });
      
      // Check third installment
      expect(insertedData[2]).toMatchObject({
        description: 'Gym Membership [3/3]',
        installment_number: 3,
        installment_total: 3,
      });
      
      // All should have same group ID
      expect(insertedData[0].installment_group_id).toBe(insertedData[1].installment_group_id);
      expect(insertedData[1].installment_group_id).toBe(insertedData[2].installment_group_id);
    });

    it('should keep the original date for the first installment and use the 1st for the rest', async () => {
      // Arrange
      const transactionData = {
        type: 'expense' as const,
        description: 'Subscription',
        amount: 10,
        category: 'Entertainment',
        date: '2025-12-15', // Mid-month
      };

      const mockResult = { data: [], error: null };
      const mockChain = createMockChain(mockResult);
      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      // Act
      await SupabaseService.addInstallmentTransactions(transactionData, 4);

      // Assert
      const insertedData = mockChain.insert.mock.calls[0][0];
      
      // First keeps original date, following ones are on the 1st
      expect(insertedData[0].date).toBe('2025-12-15');
      expect(insertedData[1].date).toBe('2026-01-01');
      expect(insertedData[2].date).toBe('2026-02-01');
      expect(insertedData[3].date).toBe('2026-03-01');
    });

    it('should preserve family member and other transaction properties', async () => {
      // Arrange
      const transactionData = {
        type: 'expense' as const,
        description: 'Car Payment',
        amount: 450,
        category: 'Transportation',
        familyMember: 'family-member-123',
        date: '2025-12-01',
      };

      const mockResult = { data: [], error: null };
      const mockChain = createMockChain(mockResult);
      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      // Act
      await SupabaseService.addInstallmentTransactions(transactionData, 2);

      // Assert
      const insertedData = mockChain.insert.mock.calls[0][0];
      
      expect(insertedData[0].family_member_id).toBe('family-member-123');
      expect(insertedData[1].family_member_id).toBe('family-member-123');
      expect(insertedData[0].type).toBe('expense');
      expect(insertedData[0].amount).toBe(450);
    });

    it('should handle year rollover correctly', async () => {
      // Arrange
      const transactionData = {
        type: 'expense' as const,
        description: 'Annual Service',
        amount: 100,
        category: 'Other',
        date: '2025-11-15',
      };

      const mockResult = { data: [], error: null };
      const mockChain = createMockChain(mockResult);
      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      // Act
      await SupabaseService.addInstallmentTransactions(transactionData, 3);

      // Assert
      const insertedData = mockChain.insert.mock.calls[0][0];
      
      expect(insertedData[0].date).toBe('2025-11-15');
      expect(insertedData[1].date).toBe('2025-12-01');
      expect(insertedData[2].date).toBe('2026-01-01'); // Year rollover
    });

    it('should use per-installment amounts when provided', async () => {
      const transactionData = {
        type: 'expense' as const,
        description: 'Laptop',
        amount: 100,
        category: 'Other',
        date: '2025-12-10',
      };

      const mockResult = { data: [], error: null };
      const mockChain = createMockChain(mockResult);
      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      await SupabaseService.addInstallmentTransactions(
        transactionData,
        3,
        SupabaseService.splitInstallmentAmounts(100, 3)
      );

      const insertedData = mockChain.insert.mock.calls[0][0];
      expect(insertedData.map((row: { amount: number }) => row.amount)).toEqual([33.34, 33.33, 33.33]);
    });
  });

  describe('splitInstallmentAmounts', () => {
    it('should split evenly when divisible', () => {
      expect(SupabaseService.splitInstallmentAmounts(300, 6)).toEqual([50, 50, 50, 50, 50, 50]);
    });

    it('should round to the cent and put leftover cents on the first installment', () => {
      expect(SupabaseService.splitInstallmentAmounts(100, 3)).toEqual([33.34, 33.33, 33.33]);
      expect(SupabaseService.splitInstallmentAmounts(10, 7)).toEqual([1.48, 1.42, 1.42, 1.42, 1.42, 1.42, 1.42]);
    });

    it('should always sum back to the total', () => {
      for (const [total, n] of [[99.99, 4], [1234.56, 12], [0.1, 3], [15.99, 36]] as const) {
        const parts = SupabaseService.splitInstallmentAmounts(total, n);
        const sumCents = parts.reduce((acc, p) => acc + Math.round(p * 100), 0);
        expect(sumCents).toBe(Math.round(total * 100));
        expect(parts.every(p => Number(p.toFixed(2)) === p)).toBe(true);
      }
    });
  });

  describe('deleteInstallmentGroup', () => {
    it('should delete all transactions in an installment group', async () => {
      // Arrange
      const groupId = 'group-uuid-123';
      const mockResult = { data: null, error: null };
      const mockChain = createMockChain(mockResult);
      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      // Act
      await SupabaseService.deleteInstallmentGroup(groupId);

      // Assert
      expect(supabase.from).toHaveBeenCalledWith('transactions');
      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.eq).toHaveBeenCalledWith('installment_group_id', groupId);
    });

    it('should throw error if deletion fails', async () => {
      // Arrange
      const groupId = 'group-uuid-123';
      const mockError = { message: 'Delete failed' };
      const mockResult = { data: null, error: mockError };
      const mockChain = createMockChain(mockResult);
      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      // Act & Assert
      await expect(
        SupabaseService.deleteInstallmentGroup(groupId)
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('deleteFutureInstallments', () => {
    it('should delete installments from specified number onwards', async () => {
      // Arrange
      const groupId = 'group-uuid-123';
      const fromNumber = 3;
      const mockResult = { data: null, error: null };
      const mockChain = createMockChain(mockResult);
      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      // Act
      await SupabaseService.deleteFutureInstallments(groupId, fromNumber);

      // Assert
      expect(supabase.from).toHaveBeenCalledWith('transactions');
      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.eq).toHaveBeenCalledWith('installment_group_id', groupId);
      expect(mockChain.gte).toHaveBeenCalledWith('installment_number', fromNumber);
    });

    it('should throw error if deletion fails', async () => {
      // Arrange
      const groupId = 'group-uuid-123';
      const mockError = { message: 'Delete failed' };
      const mockResult = { data: null, error: mockError };
      const mockChain = createMockChain(mockResult);
      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      // Act & Assert
      await expect(
        SupabaseService.deleteFutureInstallments(groupId, 2)
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('getInstallmentGroupTransactions', () => {
    it('should fetch all transactions in a group ordered by number', async () => {
      // Arrange
      const groupId = 'group-uuid-123';
      const mockTransactions = [
        {
          id: 'txn-1',
          description: 'Test [1/3]',
          installment_group_id: groupId,
          installment_number: 1,
          installment_total: 3,
          amount: 100,
          category: 'Test',
          type: 'expense',
          date: '2025-12-01',
          user_id: mockUserId,
          household_id: mockHouseholdId,
          created_at: '2025-12-06T10:00:00Z',
        },
        {
          id: 'txn-2',
          description: 'Test [2/3]',
          installment_group_id: groupId,
          installment_number: 2,
          installment_total: 3,
          amount: 100,
          category: 'Test',
          type: 'expense',
          date: '2026-01-01',
          user_id: mockUserId,
          household_id: mockHouseholdId,
          created_at: '2025-12-06T10:00:00Z',
        },
      ];
      
      const mockResult = { data: mockTransactions, error: null };
      const mockChain = createMockChain(mockResult);
      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      // Act
      const result = await SupabaseService.getInstallmentGroupTransactions(groupId);

      // Assert
      expect(supabase.from).toHaveBeenCalledWith('transactions');
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.eq).toHaveBeenCalledWith('installment_group_id', groupId);
      expect(mockChain.order).toHaveBeenCalledWith('installment_number', { ascending: true });
      expect(result).toHaveLength(2);
      expect(result[0].installment_number).toBe(1);
      expect(result[1].installment_number).toBe(2);
    });

    it('should return empty array if no transactions found', async () => {
      // Arrange
      const groupId = 'non-existent-group';
      const mockResult = { data: [], error: null };
      const mockChain = createMockChain(mockResult);
      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      // Act
      const result = await SupabaseService.getInstallmentGroupTransactions(groupId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw error if fetch fails', async () => {
      // Arrange
      const groupId = 'group-uuid-123';
      const mockError = { message: 'Fetch failed' };
      const mockResult = { data: null, error: mockError };
      const mockChain = createMockChain(mockResult);
      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      // Act & Assert
      await expect(
        SupabaseService.getInstallmentGroupTransactions(groupId)
      ).rejects.toThrow('Fetch failed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle large number of installments (36)', async () => {
      // Arrange
      const transactionData = {
        type: 'expense' as const,
        description: 'Car Loan',
        amount: 500,
        category: 'Transportation',
        date: '2025-12-01',
      };

      const mockResult = { data: [], error: null };
      const mockChain = createMockChain(mockResult);
      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      // Act
      await SupabaseService.addInstallmentTransactions(transactionData, 36);

      // Assert
      const insertedData = mockChain.insert.mock.calls[0][0];
      expect(insertedData).toHaveLength(36);
      expect(insertedData[0].description).toBe('Car Loan [1/36]');
      expect(insertedData[35].description).toBe('Car Loan [36/36]');
    });

    it('should handle income installments', async () => {
      // Arrange
      const transactionData = {
        type: 'income' as const,
        description: 'Rental Income',
        amount: 1200,
        category: 'Rent',
        date: '2025-12-01',
      };

      const mockResult = { data: [], error: null };
      const mockChain = createMockChain(mockResult);
      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      // Act
      await SupabaseService.addInstallmentTransactions(transactionData, 12);

      // Assert
      const insertedData = mockChain.insert.mock.calls[0][0];
      expect(insertedData[0].type).toBe('income');
      expect(insertedData[0].description).toBe('Rental Income [1/12]');
    });

    it('should handle empty description gracefully', async () => {
      // Arrange
      const transactionData = {
        type: 'expense' as const,
        description: '',
        amount: 50,
        category: 'Other',
        date: '2025-12-01',
      };

      const mockResult = { data: [], error: null };
      const mockChain = createMockChain(mockResult);
      vi.mocked(supabase.from).mockReturnValue(mockChain as any);

      // Act
      await SupabaseService.addInstallmentTransactions(transactionData, 2);

      // Assert
      const insertedData = mockChain.insert.mock.calls[0][0];
      expect(insertedData[0].description).toBe(' [1/2]');
      expect(insertedData[1].description).toBe(' [2/2]');
    });
  });
});
