/**
 * Integration Test Suite: Installments
 * =====================================
 * 
 * Tests installment transaction creation and deletion workflows.
 * 
 * Scenarios covered:
 * 1. Create installment series
 * 2. Delete entire installment series
 * 3. Delete future installments
 * 4. Delete single installment
 * 5. Verify installment data integrity
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  setupIntegrationTests,
  createTestUser,
  signInAsTestUser,
  TestUser,
  getCurrentUserId,
} from '../setup';
import {
  createStandardTestBudget,
  TestPersonalBudget,
} from '../helpers/testBudget';
import {
  addInstallmentTransactions,
  deleteInstallmentGroup,
  deleteFutureInstallments,
  getInstallmentGroupTransactions,
  getTransactions,
} from '../../src/services/supabaseDataService';

// Initialize test clients and cleanup
setupIntegrationTests();

describe('Integration: Installments', () => {
  let testUser: TestUser;
  let budget: TestPersonalBudget;
  let userId: string;

  beforeAll(async () => {
    // Create user, sign in, and create budget
    testUser = await createTestUser();
    await signInAsTestUser(testUser);
    budget = await createStandardTestBudget();
    userId = await getCurrentUserId();
  });

  describe('Scenario 1: Create installment series', () => {
    let groupId: string;

    it('should create 3 installment transactions', async () => {
      // Arrange
      const transactionData = {
        type: 'expense' as const,
        description: 'Netflix Subscription',
        amount: 15.99,
        category: 'Entertainment',
        date: '2025-12-15',
      };

      // Act
      const installments = await addInstallmentTransactions(transactionData, 3);

      // Assert
      expect(installments).toBeDefined();
      expect(installments).toHaveLength(3);
      
      // Store group ID for later tests
      groupId = installments[0].installment_group_id!;
      expect(groupId).toBeTruthy();
    });

    it('should have correct installment numbering', async () => {
      // Act
      const installments = await getInstallmentGroupTransactions(groupId);

      // Assert
      expect(installments).toHaveLength(3);
      expect(installments[0].installment_number).toBe(1);
      expect(installments[1].installment_number).toBe(2);
      expect(installments[2].installment_number).toBe(3);
      
      // All should have same total
      installments.forEach(inst => {
        expect(inst.installment_total).toBe(3);
      });
    });

    it('should have descriptions with installment indicators', async () => {
      // Act
      const installments = await getInstallmentGroupTransactions(groupId);

      // Assert
      expect(installments[0].description).toContain('[1/3]');
      expect(installments[1].description).toContain('[2/3]');
      expect(installments[2].description).toContain('[3/3]');
    });

    it('should keep the original date first, then the 1st of each month', async () => {
      // Act
      const installments = await getInstallmentGroupTransactions(groupId);

      // Assert
      expect(installments[0].date).toBe('2025-12-15');
      installments.slice(1).forEach(inst => {
        expect(inst.date).toMatch(/^\d{4}-\d{2}-01$/);
      });
      
      // Check sequential months
      const dates = installments.map(i => new Date(i.date));
      expect(dates[0].getMonth()).toBe(11); // December (0-indexed)
      expect(dates[1].getMonth()).toBe(0);  // January
      expect(dates[2].getMonth()).toBe(1);  // February
    });

    it('should have correct user and household IDs', async () => {
      // Act
      const installments = await getInstallmentGroupTransactions(groupId);

      // Assert
      installments.forEach(inst => {
        expect(inst.user_id).toBe(userId);
        expect(inst.household_id).toBe(budget.household_id);
      });
    });

    it('should appear in household transactions', async () => {
      // Act
      const allTransactions = await getTransactions();

      // Assert
      const installmentTxns = allTransactions.filter(
        t => t.installment_group_id === groupId
      );
      expect(installmentTxns).toHaveLength(3);
    });
  });

  describe('Scenario 2: Delete entire installment series', () => {
    let groupId: string;

    it('should create installment series to delete', async () => {
      // Arrange
      const transactionData = {
        type: 'expense' as const,
        description: 'Gym Membership',
        amount: 50,
        category: 'Health',
        date: '2025-12-01',
      };

      // Act
      const installments = await addInstallmentTransactions(transactionData, 4);
      groupId = installments[0].installment_group_id!;

      // Assert
      expect(installments).toHaveLength(4);
    });

    it('should delete all installments in the series', async () => {
      // Act
      await deleteInstallmentGroup(groupId);

      // Assert
      const remaining = await getInstallmentGroupTransactions(groupId);
      expect(remaining).toHaveLength(0);
    });

    it('should not appear in household transactions', async () => {
      // Act
      const allTransactions = await getTransactions();

      // Assert
      const installmentTxns = allTransactions.filter(
        t => t.installment_group_id === groupId
      );
      expect(installmentTxns).toHaveLength(0);
    });
  });

  describe('Scenario 3: Delete future installments', () => {
    let groupId: string;

    it('should create 6-installment series', async () => {
      // Arrange
      const transactionData = {
        type: 'expense' as const,
        description: 'Phone Bill',
        amount: 60,
        category: 'Utilities',
        date: '2025-12-01',
      };

      // Act
      const installments = await addInstallmentTransactions(transactionData, 6);
      groupId = installments[0].installment_group_id!;

      // Assert
      expect(installments).toHaveLength(6);
    });

    it('should delete installments from number 4 onwards', async () => {
      // Act
      await deleteFutureInstallments(groupId, 4);

      // Assert
      const remaining = await getInstallmentGroupTransactions(groupId);
      expect(remaining).toHaveLength(3);
      
      // Should keep installments 1, 2, 3
      expect(remaining[0].installment_number).toBe(1);
      expect(remaining[1].installment_number).toBe(2);
      expect(remaining[2].installment_number).toBe(3);
    });

    it('should keep correct total in remaining installments', async () => {
      // Act
      const remaining = await getInstallmentGroupTransactions(groupId);

      // Assert
      // Note: installment_total still shows original total (6)
      // This is expected - it's the original series size
      remaining.forEach(inst => {
        expect(inst.installment_total).toBe(6);
      });
    });
  });

  describe('Scenario 4: Delete single installment', () => {
    let groupId: string;
    let middleInstallmentId: string;

    it('should create 5-installment series', async () => {
      // Arrange
      const transactionData = {
        type: 'expense' as const,
        description: 'Streaming Service',
        amount: 12.99,
        category: 'Entertainment',
        date: '2025-12-01',
      };

      // Act
      const installments = await addInstallmentTransactions(transactionData, 5);
      groupId = installments[0].installment_group_id!;
      middleInstallmentId = installments[2].id; // 3rd installment

      // Assert
      expect(installments).toHaveLength(5);
    });

    it('should delete only the middle installment', async () => {
      // Act
      const { deleteTransaction } = await import('../../src/services/supabaseDataService');
      await deleteTransaction(middleInstallmentId);

      // Assert
      const remaining = await getInstallmentGroupTransactions(groupId);
      expect(remaining).toHaveLength(4);
      
      // Should have installments 1, 2, 4, 5 (not 3)
      const numbers = remaining.map(i => i.installment_number);
      expect(numbers).toContain(1);
      expect(numbers).toContain(2);
      expect(numbers).not.toContain(3);
      expect(numbers).toContain(4);
      expect(numbers).toContain(5);
    });
  });

  describe('Scenario 5: Verify installment data integrity', () => {
    it('should create installments with family member', async () => {
      // Arrange
      const familyMembers = budget.global_settings.familyMembers || [];
      const familyMemberId = familyMembers[0]?.id;

      if (!familyMemberId) {
        console.log('Skipping test: No family members in budget');
        return;
      }

      const transactionData = {
        type: 'expense' as const,
        description: 'Car Payment',
        amount: 450,
        category: 'Transportation',
        familyMember: familyMemberId,
        date: '2025-12-01',
      };

      // Act
      const installments = await addInstallmentTransactions(transactionData, 3);

      // Assert
      expect(installments).toHaveLength(3);
      installments.forEach(inst => {
        expect(inst.familyMember).toBe(familyMemberId);
      });
    });

    it('should create income installments', async () => {
      // Arrange
      const transactionData = {
        type: 'income' as const,
        description: 'Rental Income',
        amount: 1200,
        category: 'Rent',
        date: '2025-12-01',
      };

      // Act
      const installments = await addInstallmentTransactions(transactionData, 12);

      // Assert
      expect(installments).toHaveLength(12);
      installments.forEach(inst => {
        expect(inst.type).toBe('income');
        expect(inst.amount).toBe(1200);
      });
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

      // Act
      const installments = await addInstallmentTransactions(transactionData, 3);

      // Assert
      expect(installments).toHaveLength(3);
      
      const dates = installments.map(i => i.date);
      expect(dates[0]).toBe('2025-11-15');
      expect(dates[1]).toBe('2025-12-01');
      expect(dates[2]).toBe('2026-01-01'); // Year rollover
    });

    it('should create large installment series (36 months)', async () => {
      // Arrange
      const transactionData = {
        type: 'expense' as const,
        description: 'Car Loan',
        amount: 500,
        category: 'Transportation',
        date: '2025-12-01',
      };

      // Act
      const installments = await addInstallmentTransactions(transactionData, 36);

      // Assert
      expect(installments).toHaveLength(36);
      expect(installments[0].description).toContain('[1/36]');
      expect(installments[35].description).toContain('[36/36]');
      
      // Verify all have same group ID
      const groupIds = [...new Set(installments.map(i => i.installment_group_id))];
      expect(groupIds).toHaveLength(1);
    });
  });

  describe('Scenario 6: Multiple concurrent installment series', () => {
    it('should handle multiple installment series independently', async () => {
      // Arrange
      const series1Data = {
        type: 'expense' as const,
        description: 'Subscription A',
        amount: 10,
        category: 'Entertainment',
        date: '2025-12-01',
      };

      const series2Data = {
        type: 'expense' as const,
        description: 'Subscription B',
        amount: 20,
        category: 'Utilities',
        date: '2025-12-01',
      };

      // Act
      const series1 = await addInstallmentTransactions(series1Data, 3);
      const series2 = await addInstallmentTransactions(series2Data, 4);

      const groupId1 = series1[0].installment_group_id!;
      const groupId2 = series2[0].installment_group_id!;

      // Assert
      expect(groupId1).not.toBe(groupId2);
      expect(series1).toHaveLength(3);
      expect(series2).toHaveLength(4);

      // Verify series are independent
      const group1Txns = await getInstallmentGroupTransactions(groupId1);
      const group2Txns = await getInstallmentGroupTransactions(groupId2);

      expect(group1Txns).toHaveLength(3);
      expect(group2Txns).toHaveLength(4);

      // Delete one series shouldn't affect the other
      await deleteInstallmentGroup(groupId1);

      const group1After = await getInstallmentGroupTransactions(groupId1);
      const group2After = await getInstallmentGroupTransactions(groupId2);

      expect(group1After).toHaveLength(0);
      expect(group2After).toHaveLength(4); // Still intact
    });
  });
});
