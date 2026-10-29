---
paths:
  - "tests/**"
  - "src/**/*.test.ts"
  - "src/**/*.test.tsx"
  - "src/test/**"
  - "src/setupTests.ts"
  - "vitest*.config.ts"
---

# Tests

- New unit tests go in `tests/`, mirroring `src/` (`src/services/foo.ts` → `tests/services/foo.test.ts`). Run one file with `npx vitest run tests/services/foo.test.ts`, everything with `npm run test:run`.
- `src/setupTests.ts` → `src/test/setup.ts` runs for every unit test: it mocks `src/contexts/AuthContext` (signed-in `test-user-123`), stubs `ResizeObserver` and `window.alert`, and silences `console.*`. Assert on mocked console spies; don't expect output.
- Mock the Supabase client per file with `vi.mock('../../src/lib/supabase', …)`. Services start most calls with a `household_members` lookup, so route mocks by table: copy `mockTables` from `tests/services/personalBudgetService.test.ts` instead of counting calls. Assert on `household_id` scoping, not just on return values.
- Components that navigate need `<MemoryRouter>`; components using React Query hooks need a `QueryClientProvider` with `retry: false`.
- Query by role and label (`getByRole('button', { name: … })`). Many tests assert on visible text, so when copy changes, update the test to the new wording rather than loosening it to a regex.
- Unit tests can't reach a real Supabase project: `vitest.config.ts` points the client at a closed local port (`http://127.0.0.1:9`), and `tests/integration/**` is excluded. A few component tests still let `listConnections()` fire a request that fails fast there; mock the service in new tests instead of relying on that.
- Integration suites (`tests/integration/`, `npm run test:integration`) need a separate Supabase test project in `.env.test.local`. `globalSetup.ts` refuses to run against the app's own project unless `ALLOW_PRODUCTION_INTEGRATION_TESTS=1` is set; never set it yourself. They run sequentially and clean up through `tests/integration/helpers/`.
