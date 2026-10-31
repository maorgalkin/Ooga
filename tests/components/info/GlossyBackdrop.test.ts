import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : path.endsWith('.tsx') ? [path] : [];
  });
}

describe('GlossyBackdrop', () => {
  // A page container that starts its own stacking context traps the windows rendered inside it
  // under the portalled ones: the bank import, opened from Add transaction, ended up behind it.
  it('sits in page containers that start no stacking context', () => {
    const offenders = sources('src')
      .filter((file) => !file.endsWith('GlossyBackdrop.tsx'))
      .flatMap((file) => {
        const lines = readFileSync(file, 'utf8').split('\n');
        return lines.flatMap((line, i) =>
          line.includes('<GlossyBackdrop') && /\bisolate\b|\bz-\d|\bz-\[/.test(lines[i - 1] ?? '') ? [`${file}:${i}`] : [],
        );
      });
    expect(offenders).toEqual([]);
  });
});
