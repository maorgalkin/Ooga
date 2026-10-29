/**
 * Global Setup for Integration Tests
 * ===================================
 * 
 * This file runs before any integration tests.
 * It loads environment variables and validates the test configuration.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load test environment variables
// Priority: .env.test.local > .env.test > .env
config({ path: resolve(process.cwd(), '.env.test.local') });
config({ path: resolve(process.cwd(), '.env.test') });
config({ path: resolve(process.cwd(), '.env') });

// Validate required environment variables
const requiredVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

const optionalVars = [
  'VITE_SUPABASE_TEST_URL',
  'VITE_SUPABASE_TEST_ANON_KEY',
  'VITE_SUPABASE_TEST_SERVICE_ROLE_KEY',
];

// Check for test-specific or fallback variables
const supabaseUrl = process.env.VITE_SUPABASE_TEST_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_TEST_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  ❌ INTEGRATION TEST CONFIGURATION ERROR                         ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  Missing required Supabase credentials.                          ║
║                                                                   ║
║  Create .env.test.local with:                                    ║
║    VITE_SUPABASE_TEST_URL=https://your-project.supabase.co       ║
║    VITE_SUPABASE_TEST_ANON_KEY=your-anon-key                     ║
║    VITE_SUPABASE_TEST_SERVICE_ROLE_KEY=your-service-key          ║
║                                                                   ║
║  Or ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY          ║
║  are set in your environment.                                    ║
║                                                                   ║
║  See tests/integration/README.md for details.                    ║
╚══════════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

// Refuse to run against the app's own project (production, via .env.local) unless
// someone explicitly opts in: these suites create and delete users and data.
const usingAppProject =
  !process.env.VITE_SUPABASE_TEST_URL ||
  process.env.VITE_SUPABASE_TEST_URL === process.env.VITE_SUPABASE_URL;

if (usingAppProject && process.env.ALLOW_PRODUCTION_INTEGRATION_TESTS !== '1') {
  console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  ❌ REFUSING TO RUN AGAINST THE APP'S SUPABASE PROJECT            ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  No separate test project is configured, so these tests would    ║
║  create and delete users and data in your production database.   ║
║                                                                   ║
║  Create a separate test project and set, in .env.test.local:     ║
║    VITE_SUPABASE_TEST_URL                                        ║
║    VITE_SUPABASE_TEST_ANON_KEY                                   ║
║    VITE_SUPABASE_TEST_SERVICE_ROLE_KEY                           ║
║                                                                   ║
║  To run against VITE_SUPABASE_URL anyway, on purpose:            ║
║    ALLOW_PRODUCTION_INTEGRATION_TESTS=1 npm run test:integration ║
║                                                                   ║
╚══════════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

// Warn if service role key is missing
if (!process.env.VITE_SUPABASE_TEST_SERVICE_ROLE_KEY) {
  console.warn(`
╔══════════════════════════════════════════════════════════════════╗
║  ⚠️  WARNING: Service role key not configured                     ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  Some test operations will not work:                             ║
║    - User creation without email verification                    ║
║    - Data cleanup bypassing RLS policies                         ║
║    - Cross-user data verification                                ║
║                                                                   ║
║  Set VITE_SUPABASE_TEST_SERVICE_ROLE_KEY for full functionality. ║
║                                                                   ║
╚══════════════════════════════════════════════════════════════════╝
`);
}

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  🧪 Integration Test Environment                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  Supabase URL: ${supabaseUrl.substring(0, 40).padEnd(40)}       ║
║  Service Role: ${process.env.VITE_SUPABASE_TEST_SERVICE_ROLE_KEY ? '✓ Configured' : '✗ Not configured'}                               ║
╚══════════════════════════════════════════════════════════════════╝
`);
