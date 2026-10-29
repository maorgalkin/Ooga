/**
 * Vitest Configuration for Integration Tests
 * ===========================================
 * 
 * Separate config for integration tests that run against real Supabase.
 * 
 * Key differences from unit tests:
 * - Uses 'node' environment (no jsdom)
 * - Loads .env.test.local for test credentials
 * - Longer timeouts for network operations
 * - Sequential execution (tests may depend on database state)
 * - No mocking of Supabase
 * 
 * Run with: npm run test:integration
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Use Node environment (no DOM needed for integration tests)
    environment: 'node',
    
    // Only run files in integration test directory
    include: ['tests/integration/**/*.integration.test.ts'],
    
    // Exclude unit tests
    exclude: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'node_modules',
      // Never run yet and unsafe as written (it would load the app's production client);
      // see the note at the top of the file before re-enabling.
      'tests/integration/suites/06-installments.integration.test.ts',
    ],
    
    // Load test environment variables
    env: {
      // Loaded from .env.test.local
    },
    
    // Global setup file
    setupFiles: ['./tests/integration/globalSetup.ts'],
    
    // Longer timeouts for database operations
    testTimeout: 30000,     // 30 seconds per test
    hookTimeout: 60000,     // 60 seconds for setup/teardown
    
    // Run tests sequentially (some tests depend on DB state)
    sequence: {
      shuffle: false,
    },
    
    // Don't run in parallel (avoid race conditions)
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,   // Single process for all tests
      },
    },
    
    // Reporter with more detail
    reporters: ['verbose'],
    
    // Fail fast on first error (helpful for debugging)
    bail: 1,
  },
  
  // Resolve paths
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@test': resolve(__dirname, 'tests/integration'),
    },
  },
});
