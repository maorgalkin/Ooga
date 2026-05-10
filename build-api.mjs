/**
 * Pre-bundles Vercel API functions with esbuild.
 *
 * Vercel's @vercel/node does NOT bundle local imports when the project has
 * "type":"module" — local TypeScript imports fail at runtime with
 * FUNCTION_INVOCATION_FAILED. Pre-bundling each function to a single ESM .js
 * file avoids this entirely.
 *
 * Source:  api-src/*.ts  (TypeScript handlers + shared libs in lib/)
 * Output:  api/*.js      (ESM bundles, one per handler — Vercel uses these)
 */

import { build } from 'esbuild';
import { readdir, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const srcDir = path.join(__dirname, 'api-src');
const outDir = path.join(__dirname, 'api');

const files = await readdir(srcDir);
const entryPoints = files
  .filter(f => f.endsWith('.ts') && !f.includes('.d.'))
  .map(f => path.join(srcDir, f));

if (entryPoints.length === 0) {
  console.log('No API entry points found in api-src/.');
  process.exit(0);
}

await mkdir(outDir, { recursive: true });

// Bundle Vercel serverless functions
await build({
  entryPoints,
  bundle: true,
  platform: 'node',
  format: 'esm',   // ESM output — compatible with "type":"module" in package.json
  target: 'node18',
  outdir: outDir,
  allowOverwrite: true,
});

console.log(`✓ Bundled ${entryPoints.length} API functions: api-src/*.ts → api/*.js`);

// Bundle local relay (runs on user's Mac, residential IP, bypasses Cal WAF)
await build({
  entryPoints: [path.join(__dirname, 'relay-src', 'relay.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: path.join(__dirname, 'relay.js'),
  allowOverwrite: true,
  // @vercel/node is types-only in relay context — don't try to bundle it
  external: [],
});

console.log('✓ Bundled local relay: relay-src/relay.ts → relay.js');

