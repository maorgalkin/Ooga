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

await build({
  entryPoints,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  outdir: outDir,
  allowOverwrite: true,
});

console.log(`✓ Bundled ${entryPoints.length} API functions: api-src/*.ts → api/*.js`);


