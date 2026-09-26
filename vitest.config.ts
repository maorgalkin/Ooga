import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    // Claude Code worktrees live under .claude/ and contain full copies of the repo
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
