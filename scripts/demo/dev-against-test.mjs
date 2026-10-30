// Runs the Vite dev server against the test Supabase project instead of the app's own,
// so the demo household used for guide screenshots never touches real data.
// Usage: node scripts/demo/dev-against-test.mjs [--preview]   (serves on http://localhost:5174)
// --preview builds for production first, so dev-only controls stay out of screenshots.
import { spawn, spawnSync } from 'node:child_process';
import { testProject } from './guard.mjs';

const { url, anonKey } = testProject();

// Only the test URL and anon key reach Vite: in dev, import.meta.env exposes every VITE_*
// variable it can see, so nothing else with that prefix is passed through.
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('VITE_')));
Object.assign(env, { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anonKey });
// Local only: the project folder holds the test project's env files
const serve = ['--port', '5174', '--strictPort', '--host', '127.0.0.1'];

const outDir = 'node_modules/.cache/ooga-demo-dist';
if (process.argv.includes('--preview')) {
  const build = spawnSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], { stdio: 'inherit', env });
  if (build.status !== 0) process.exit(build.status ?? 1);
  spawn('npx', ['vite', 'preview', '--outDir', outDir, ...serve], { stdio: 'inherit', env });
} else {
  spawn('npx', ['vite', ...serve], { stdio: 'inherit', env });
}
