/**
 * Integration Test Suite 5: Multi-User Household
 * ===============================================
 * 
 * Tests household sharing between multiple users.
 * 
 * Scenarios covered:
 * 1. Create second user
 * 2. Add second user to first user's household
 * 3. Second user creates transactions
 * 4. First user sees alerts from second user's transactions
 * 5. First user purges alerts
 * 6. Second user still sees alerts (per-user alert views)
 * 7. Cleanup all test data
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  setupIntegrationTests,
  createTestUser,
  signInAsTestUser,
  signOut,
  deleteTestUser,
  TestUser,
  waitFor,
  getAnonClient,
} from '../setup';
import {
  verifyUserHasHousehold,
  addUserToHousehold,
  removeUserFromHousehold,
  countHouseholdMembers,
  TestHousehold,
} from '../helpers/testHousehold';
import {
  createTestBudget,
  TestPersonalBudget,
} from '../helpers/testBudget';
import {
  createExpense,
  createExpenseByName,
  getCategorySpending,
  getCategorySpendingByName,
} from '../helpers/testTransaction';
import {
  getUnviewedAlerts,
  getAlertBadgeCount,
  purgeAllAlerts,
  verifyUserHasUnviewedAlerts,
  cleanupTestAlerts,
} from '../helpers/testAlerts';

// Initialize test clients and cleanup
setupIntegrationTests();

describe('Suite 5: Multi-User Household', () => {
  let user1: TestUser;
  let user2: TestUser;
  let household: TestHousehold;
  let budget: TestPersonalBudget;
  let testCategoryId: string;

  const CATEGORY_LIMIT = 100;

  describe('Scenario 1: Setup first user with budget', () => {
    it('should create first user with household', async () => {
      // Act
      user1 = await createTestUser();
      await signInAsTestUser(user1);
      household = await verifyUserHasHousehold(user1.id);

      // Assert
      expect(user1).toBeDefined();
      expect(household).toBeDefined();
    });

    it('should create a budget for testing alerts', async () => {
      // Act
      budget = await createTestBudget([
        { name: 'SharedCategory', icon: '👨‍👩‍👧‍👦', monthlyLimit: CATEGORY_LIMIT },
      ]);
      testCategoryId = budget.categories[0].id;

      // Assert
      expect(budget).toBeDefined();
      expect(budget.household_id).toBe(household.id);
    });
  });

  describe('Scenario 2: Create and add second user', () => {
    beforeAll(async () => {
      await signOut();
    });

    it('should create second user', async () => {
      // Act
      user2 = await createTestUser();

      // Assert
      expect(user2).toBeDefined();
      expect(user2.id).not.toBe(user1.id);
    });

    it('should remove second user from their auto-created household', async () => {
      // The second user gets their own household automatically
      // We need to remove them from it first
      
      // Act
      await removeUserFromHousehold(user2.id);
      
      // Note: We're not deleting the orphan household here
      // The cleanup will handle it
    });

    it('should add second user to first user household', async () => {
      // Act
      await addUserToHousehold(household.id, user2.id, 'participant');

      // Assert
      const memberCount = await countHouseholdMembers(household.id);
      expect(memberCount).toBe(2);
    });
  });

  describe('Scenario 3: Second user creates transactions', () => {
    beforeAll(async () => {
      // Sign in as second user
      await signInAsTestUser(user2);
    });

    it('should create expense that exceeds budget', async () => {
      // Act - create expense that goes over 100%
      await createExpenseByName(110, 'Groceries', 'User2 expense');

      // Assert
      const spending = await getCategorySpendingByName('Groceries');
      expect(spending).toBe(110);
    });
  });

  // ============================================================================
  // NOTE: Scenarios 4-6 (Alerts) are skipped because alerts are computed 
  // client-side, NOT stored in a budget_alerts table. There's no database
  // state to test. The user_alert_views table only tracks dismissed alerts.
  // ============================================================================

  describe.skip('Scenario 4: First user sees alerts', () => {
    beforeAll(async () => {
      // Sign out user2, sign in user1
      await signOut();
      await signInAsTestUser(user1);
    });

    it('should show alerts to first user', async () => {
      // Wait for alerts to be created
      await waitFor(async () => {
        const count = await getAlertBadgeCount();
        return count > 0;
      }, { timeout: 5000 });

      // Assert
      const alerts = await getUnviewedAlerts();
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });

    it('should have alert for the shared category', async () => {
      // Act
      const alerts = await getUnviewedAlerts();
      const categoryAlert = alerts.find(a => a.category_id === testCategoryId);

      // Assert
      expect(categoryAlert).toBeDefined();
      expect(categoryAlert?.type).toBe('exceeded');
    });
  });

  describe.skip('Scenario 5: First user purges alerts', () => {
    it('should purge alerts for first user', async () => {
      // Act
      const purgedCount = await purgeAllAlerts();

      // Assert
      expect(purgedCount).toBeGreaterThanOrEqual(1);
    });

    it('should have zero alerts for first user', async () => {
      // Act
      const count = await getAlertBadgeCount();

      // Assert
      expect(count).toBe(0);
    });
  });

  describe.skip('Scenario 6: Second user still sees alerts', () => {
    beforeAll(async () => {
      // Sign out user1, sign in user2
      await signOut();
      await signInAsTestUser(user2);
    });

    it('should still show alerts to second user', async () => {
      // Act
      const count = await getAlertBadgeCount();

      // Assert - second user hasn't purged, should still see alerts
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('should have unviewed alerts for second user', async () => {
      // Act
      const unviewedCount = await verifyUserHasUnviewedAlerts(user2.id);

      // Assert
      expect(unviewedCount).toBeGreaterThanOrEqual(1);
    });

    it('should NOT have unviewed alerts for first user anymore', async () => {
      // Act - verify user1's alerts are cleared
      const unviewedCount = await verifyUserHasUnviewedAlerts(user1.id, 0);

      // Assert
      expect(unviewedCount).toBe(0);
    });
  });

  describe('Scenario 7: Cleanup', () => {
    it.skip('should clean up test alerts', async () => {
      // Skipped: No budget_alerts table exists
      await cleanupTestAlerts(household.id);
    });

    it('should sign out', async () => {
      // Act
      await signOut();
      
      // Assert - get client and verify no session
      const client = getAnonClient();
      const { data: { session } } = await client.auth.getSession();
      expect(session).toBeNull();
    });

    // Note: User deletion happens automatically in afterAll via setupIntegrationTests
  });

  afterAll(async () => {
    // Cleanup is handled by setupIntegrationTests()
    // which calls cleanupAllTestUsers() in afterAll
  });
});
