# Integration Tests - Ooga

## Overview

This directory contains **integration tests** that run against a real Supabase database. Unlike unit tests that mock Supabase, these tests verify actual database operations, RLS policies, and cross-user scenarios.

## Prerequisites

### 1. Test Supabase Project

We use a **separate Supabase project** for integration tests to avoid polluting production data.

**Option A: Use existing project with test prefix**
- Tests create data with `__TEST__` prefix
- Cleanup runs after each test suite
- ⚠️ Risk: Test failures may leave orphan data

**Option B: Dedicated test project (Recommended)**
- Create a new Supabase project for testing
- Apply all migrations from `supabase/migrations/`
- No risk to production data

### 2. Environment Variables

Create `.env.test.local` in project root (gitignored):

```env
# Integration Test Supabase Credentials
VITE_SUPABASE_TEST_URL=https://your-test-project.supabase.co
VITE_SUPABASE_TEST_ANON_KEY=your-test-anon-key
VITE_SUPABASE_TEST_SERVICE_ROLE_KEY=your-service-role-key
```

**Why Service Role Key?**
- Creates test users without email verification
- Bypasses RLS for cleanup operations
- Never commit this key!

### 3. Test User Credentials

Tests create temporary users with:
- Email: `test-{timestamp}@ooga-test.local`
- Password: `TestPassword123!`

## Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific test file
npm run test:integration -- household.integration.test.ts

# Run with verbose output
npm run test:integration -- --reporter=verbose
```

## Test Structure

```
tests/integration/
├── README.md                    # This file
├── setup.ts                     # Core test utilities & Supabase clients
├── globalSetup.ts               # Environment validation (runs first)
├── helpers/
│   ├── index.ts                 # Re-exports all helpers
│   ├── testHousehold.ts         # Household creation/verification
│   ├── testBudget.ts            # Budget & category helpers
│   ├── testTransaction.ts       # Income/expense helpers
│   └── testAlerts.ts            # Alert verification & purging
└── suites/
    ├── 01-user-onboarding.integration.test.ts
    ├── 02-budget-creation.integration.test.ts
    ├── 03-transactions.integration.test.ts
    ├── 04-alerts.integration.test.ts
    └── 05-multi-user-household.integration.test.ts
```

## Configuration Files

- `vitest.integration.config.ts` - Vitest config for integration tests
- `.env.test.local` - Your test credentials (gitignored)
- `.env.test.local.example` - Template for credentials

## Test Scenarios Covered

### Suite 1: User Onboarding
- [ ] Create new user via Supabase Auth
- [ ] Verify automatic household creation
- [ ] Verify user is household owner

### Suite 2: Budget Creation
- [ ] Create personal budget with 10 categories
- [ ] Verify categories in database
- [ ] Verify monthly budget auto-creation

### Suite 3: Transactions
- [ ] Create income transactions
- [ ] Create expense transactions
- [ ] Verify transaction totals

### Suite 4: Alerts
- [ ] Exceed category limit (warning)
- [ ] Surpass category limit (over budget)
- [ ] Verify alert badge count
- [ ] Purge alerts
- [ ] Verify alerts cleared

### Suite 5: Multi-User Household
- [ ] Create second user
- [ ] Invite to household
- [ ] Accept invitation
- [ ] Second user creates transactions
- [ ] First user sees alerts
- [ ] First user purges alerts
- [ ] Second user still sees alert after purge
- [ ] Cleanup all test data

## Writing New Integration Tests

### Template

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  setupIntegrationTests,
  createTestUser,
  signInAsTestUser,
  signOut,
  TestUser,
} from '../setup';

// Initialize clients and enable auto-cleanup
setupIntegrationTests();

describe('Feature: Your Feature Name', () => {
  let testUser: TestUser;

  beforeAll(async () => {
    testUser = await createTestUser();
    await signInAsTestUser(testUser);
  });

  afterAll(async () => {
    await signOut();
    // User cleanup is automatic via setupIntegrationTests()
  });

  it('should do something', async () => {
    // Arrange
    // Act
    // Assert with actual database queries
  });
});
```

### Best Practices

1. **Always clean up** - Use `afterAll` to remove test data
2. **Use unique identifiers** - Prefix with `__TEST__` or timestamp
3. **Test RLS** - Verify users can only see their own data
4. **Test cross-user scenarios** - Verify household sharing works
5. **Check database state** - Don't just check API responses

## Troubleshooting

### "User not found" errors
- Check `.env.test.local` exists and has correct values
- Verify test Supabase project has all migrations applied

### "RLS policy violation" errors
- Service role key may be wrong
- Check policy definitions in migrations

### Tests timing out
- Supabase project may be paused (free tier)
- Wake it up by visiting the dashboard

### Orphan test data
Run cleanup script:
```sql
-- In Supabase SQL Editor
DELETE FROM transactions WHERE description LIKE '__TEST__%';
DELETE FROM personal_budgets WHERE name LIKE '__TEST__%';
DELETE FROM households WHERE name LIKE '__TEST__%';
-- etc.
```

## CI/CD Integration

For GitHub Actions, add secrets:
- `SUPABASE_TEST_URL`
- `SUPABASE_TEST_ANON_KEY`
- `SUPABASE_TEST_SERVICE_ROLE_KEY`

See `.github/workflows/test.yml` for configuration.
