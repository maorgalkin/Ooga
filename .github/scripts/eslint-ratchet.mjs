// Fails when ESLint reports more errors than ESLINT_MAX_ERRORS, so the count can only go down.
// The repo carries pre-existing lint errors; lower ESLINT_MAX_ERRORS in .github/workflows/ci.yml
// whenever you fix some, and make lint fully blocking (`npm run lint`) once it reaches 0.
import { execFileSync } from 'node:child_process';

const max = Number(process.env.ESLINT_MAX_ERRORS);
if (!Number.isInteger(max) || max < 0) {
  console.error('Set ESLINT_MAX_ERRORS to a non-negative integer.');
  process.exit(2);
}

let output;
try {
  output = execFileSync('npx', ['eslint', '.', '--format', 'json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (error) {
  // ESLint exits 1 when it reports errors; anything else (exit 2, no output) is a crash
  if (error.status !== 1 || !error.stdout) throw error;
  output = error.stdout;
}

const results = JSON.parse(output);
const errors = results.reduce((sum, file) => sum + file.errorCount, 0);
const warnings = results.reduce((sum, file) => sum + file.warningCount, 0);

const worst = results
  .filter((file) => file.errorCount > 0)
  .sort((a, b) => b.errorCount - a.errorCount)
  .slice(0, 15);
for (const file of worst) {
  console.log(`${String(file.errorCount).padStart(4)}  ${file.filePath.replace(`${process.cwd()}/`, '')}`);
}

console.log(`ESLint: ${errors} errors, ${warnings} warnings (baseline allows ${max} errors).`);
if (errors > max) {
  console.log(`::error::ESLint errors went up from ${max} to ${errors}. Run \`npm run lint\` and fix the new ones.`);
  process.exit(1);
}
if (errors < max) {
  console.log(`::notice::ESLint errors dropped to ${errors}. Lower ESLINT_MAX_ERRORS in .github/workflows/ci.yml to lock it in.`);
}
