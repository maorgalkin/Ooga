/**
 * Integration Test Setup
 * =======================
 * 
 * This module provides utilities for integration tests that run against
 * a real Supabase database. It handles:
 * 
 * 1. Test Supabase client initialization
 * 2. Test user creation/deletion
 * 3. Test data cleanup
 * 4. Service role access for admin operations
 * 
 * IMPORTANT: These tests require a separate Supabase project or careful
 * cleanup to avoid polluting production data.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, afterAll } from 'vitest';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Test configuration loaded from environment variables.
 * Create `.env.test.local` with these values (see README.md).
 */
interface TestConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
}

function loadTestConfig(): TestConfig {
  const supabaseUrl = process.env.VITE_SUPABASE_TEST_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_TEST_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.VITE_SUPABASE_TEST_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase credentials for integration tests.\n' +
      'Create .env.test.local with VITE_SUPABASE_TEST_URL and VITE_SUPABASE_TEST_ANON_KEY\n' +
      'Or ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
    );
  }

  if (!supabaseServiceRoleKey) {
    console.warn(
      '⚠️  VITE_SUPABASE_TEST_SERVICE_ROLE_KEY not set.\n' +
      'Some cleanup operations may fail due to RLS policies.'
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey: supabaseServiceRoleKey || '',
  };
}

// =============================================================================
// SUPABASE CLIENTS
// =============================================================================

let config: TestConfig;
let anonClient: SupabaseClient;
let serviceClient: SupabaseClient | null = null;

/**
 * Initialize test clients. Call this before running tests.
 */
export function initializeTestClients(): void {
  config = loadTestConfig();
  
  // Anonymous client - respects RLS policies (like a normal user)
  anonClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Service role client - bypasses RLS (for admin operations)
  if (config.supabaseServiceRoleKey) {
    serviceClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
}

/**
 * Get the anonymous Supabase client (respects RLS).
 * Use this for testing normal user operations.
 */
export function getAnonClient(): SupabaseClient {
  if (!anonClient) {
    initializeTestClients();
  }
  return anonClient;
}

/**
 * Get the service role Supabase client (bypasses RLS).
 * Use this for cleanup and verification operations.
 */
export function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    if (!config?.supabaseServiceRoleKey) {
      throw new Error(
        'Service role client not available. Set VITE_SUPABASE_TEST_SERVICE_ROLE_KEY.'
      );
    }
    initializeTestClients();
  }
  return serviceClient!;
}

// =============================================================================
// TEST USER MANAGEMENT
// =============================================================================

/**
 * Test user credentials and metadata.
 */
export interface TestUser {
  id: string;
  email: string;
  password: string;
  createdAt: Date;
}

/**
 * Registry of all test users created during test runs.
 * Used for cleanup in afterAll hooks.
 */
const createdTestUsers: TestUser[] = [];

/**
 * Generate a unique test email address.
 * Format: test-{timestamp}-{random}@ooga-test.local
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `test-${timestamp}-${random}@ooga-test.local`;
}

/**
 * Default password for test users.
 * Meets Supabase password requirements.
 */
export const TEST_PASSWORD = 'TestPassword123!';

/**
 * Create a new test user via Supabase Auth.
 * 
 * Uses service role to skip email verification.
 * Automatically registers for cleanup.
 * 
 * @param email Optional custom email (defaults to generated)
 * @returns TestUser object with credentials
 */
export async function createTestUser(email?: string): Promise<TestUser> {
  const client = getServiceClient();
  const userEmail = email || generateTestEmail();

  const { data, error } = await client.auth.admin.createUser({
    email: userEmail,
    password: TEST_PASSWORD,
    email_confirm: true, // Skip email verification
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  const testUser: TestUser = {
    id: data.user.id,
    email: userEmail,
    password: TEST_PASSWORD,
    createdAt: new Date(),
  };

  createdTestUsers.push(testUser);
  console.log(`✓ Created test user: ${userEmail}`);

  return testUser;
}

/**
 * Sign in as a test user.
 * Returns an authenticated Supabase client for that user.
 */
export async function signInAsTestUser(user: TestUser): Promise<SupabaseClient> {
  const client = getAnonClient();
  
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error) {
    throw new Error(`Failed to sign in as test user: ${error.message}`);
  }

  return client;
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  const client = getAnonClient();
  await client.auth.signOut();
}

/**
 * Delete a test user and all their data.
 * Uses service role to bypass RLS.
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const client = getServiceClient();

  try {
    // Delete user data in order (respecting foreign keys)
    await client.from('user_alert_views').delete().eq('user_id', userId);
    await client.from('budget_adjustments').delete().eq('user_id', userId);
    await client.from('category_adjustment_history').delete().eq('user_id', userId);
    await client.from('transactions').delete().eq('user_id', userId);
    await client.from('monthly_budgets').delete().eq('user_id', userId);
    await client.from('personal_budgets').delete().eq('user_id', userId);
    await client.from('categories').delete().eq('user_id', userId);
    
    // Get user's household membership
    const { data: membership } = await client
      .from('household_members')
      .select('household_id, role')
      .eq('user_id', userId)
      .single();

    if (membership) {
      // Delete household membership
      await client.from('household_members').delete().eq('user_id', userId);

      // If user was owner and sole member, delete the household
      if (membership.role === 'owner') {
        const { data: otherMembers } = await client
          .from('household_members')
          .select('id')
          .eq('household_id', membership.household_id);

        if (!otherMembers || otherMembers.length === 0) {
          await client.from('households').delete().eq('id', membership.household_id);
        }
      }
    }

    // Delete family members created by this user
    await client.from('family_members').delete().eq('user_id', userId);

    // Finally, delete the auth user
    const { error } = await client.auth.admin.deleteUser(userId);
    if (error) {
      console.warn(`⚠️  Could not delete auth user ${userId}: ${error.message}`);
    } else {
      console.log(`✓ Deleted test user: ${userId}`);
    }
  } catch (err) {
    console.error(`Error cleaning up user ${userId}:`, err);
    throw err;
  }
}

/**
 * Clean up all test users created during this test run.
 * Call this in a global afterAll hook.
 */
export async function cleanupAllTestUsers(): Promise<void> {
  console.log(`\nCleaning up ${createdTestUsers.length} test user(s)...`);
  
  for (const user of createdTestUsers) {
    try {
      await deleteTestUser(user.id);
    } catch (err) {
      console.error(`Failed to clean up user ${user.email}:`, err);
    }
  }
  
  createdTestUsers.length = 0; // Clear the array
}

// =============================================================================
// TEST DATA HELPERS
// =============================================================================

/**
 * Prefix for test data to make it easily identifiable.
 */
export const TEST_PREFIX = '__TEST__';

/**
 * Create a test-prefixed name.
 */
export function testName(name: string): string {
  return `${TEST_PREFIX}${name}`;
}

/**
 * Wait for a condition to be true, with timeout.
 * Useful for waiting for triggers/async operations.
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Get the current authenticated user's ID.
 */
export async function getCurrentUserId(): Promise<string> {
  const client = getAnonClient();
  const { data: { user }, error } = await client.auth.getUser();
  
  if (error || !user) {
    throw new Error('No authenticated user');
  }
  
  return user.id;
}

// =============================================================================
// GLOBAL SETUP/TEARDOWN
// =============================================================================

/**
 * Global setup hook for integration tests.
 * Call this at the start of your test file.
 */
export function setupIntegrationTests(): void {
  beforeAll(() => {
    initializeTestClients();
  });

  afterAll(async () => {
    await cleanupAllTestUsers();
  });
}
