/**
 * Integration Test Suite 1: User Onboarding
 * ==========================================
 * 
 * Tests user creation and automatic household setup.
 * 
 * Scenarios covered:
 * 1. Create new user via Supabase Auth
 * 2. Verify automatic household creation (trigger)
 * 3. Verify user is household owner
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  setupIntegrationTests,
  createTestUser,
  signInAsTestUser,
  signOut,
  TestUser,
} from '../setup';
import {
  verifyUserHasHousehold,
  getHouseholdMembers,
} from '../helpers/testHousehold';

// Initialize test clients and cleanup
setupIntegrationTests();

describe('Suite 1: User Onboarding', () => {
  let testUser: TestUser;

  describe('Scenario 1: Create new user via Supabase Auth', () => {
    it('should create a new user successfully', async () => {
      // Arrange & Act
      testUser = await createTestUser();

      // Assert
      expect(testUser).toBeDefined();
      expect(testUser.id).toBeTruthy();
      expect(testUser.email).toMatch(/^test-\d+-[a-z0-9]+@ooga-test\.local$/);
    });

    it('should be able to sign in as the new user', async () => {
      // Arrange
      expect(testUser).toBeDefined();

      // Act
      const client = await signInAsTestUser(testUser);
      const { data: { user } } = await client.auth.getUser();

      // Assert
      expect(user).toBeDefined();
      expect(user?.id).toBe(testUser.id);
      expect(user?.email).toBe(testUser.email);
    });
  });

  describe('Scenario 2: Verify automatic household creation', () => {
    it('should have created a household for the new user', async () => {
      // Arrange - user should already be signed in from previous test
      
      // Act
      const household = await verifyUserHasHousehold(testUser.id);

      // Assert
      expect(household).toBeDefined();
      expect(household.id).toBeTruthy();
      expect(household.created_by).toBe(testUser.id);
    });

    it('should have created the household via database trigger', async () => {
      // This verifies the Supabase trigger is working
      // The household should exist immediately after user creation
      
      // Act
      const household = await verifyUserHasHousehold(testUser.id);
      const members = await getHouseholdMembers(household.id);

      // Assert - household should have exactly 1 member
      expect(members).toHaveLength(1);
      expect(members[0].user_id).toBe(testUser.id);
    });
  });

  describe('Scenario 3: Verify user is household owner', () => {
    it('should have assigned owner role to the user', async () => {
      // Act
      const household = await verifyUserHasHousehold(testUser.id);
      const members = await getHouseholdMembers(household.id);

      // Assert
      const userMembership = members.find(m => m.user_id === testUser.id);
      expect(userMembership).toBeDefined();
      expect(userMembership?.role).toBe('owner');
    });

    it('should have set created_by to the user ID', async () => {
      // Act
      const household = await verifyUserHasHousehold(testUser.id);

      // Assert
      expect(household.created_by).toBe(testUser.id);
    });
  });

  afterAll(async () => {
    await signOut();
  });
});
