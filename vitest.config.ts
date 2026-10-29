import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    exclude: [
      ...configDefaults.exclude,
      // Claude Code worktrees live under .claude/ and contain full copies of the repo
      '.claude/**',
      // These run against a real Supabase project: `npm run test:integration`
      'tests/integration/**',
    ],
    // Unit tests must never reach a real Supabase project. These placeholders override
    // .env.local so src/lib/supabase.ts can load; tests mock the client or services.
    // Port 9 (discard) is closed, so an unmocked request fails fast instead of hitting
    // a local Supabase on its usual port 54321.
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:9',
      VITE_SUPABASE_ANON_KEY: 'unit-test-anon-key',
    },
  },
});
