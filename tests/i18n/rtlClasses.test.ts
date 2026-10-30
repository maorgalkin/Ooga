import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Hebrew mirrors the layout with dir="rtl", which only works if classes name a side logically
// (ms-/me-, ps-/pe-, start-/end-, text-start, rounded-s, border-s). These checks keep physical
// sides from creeping back in.

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });

// Pointers drawn over fixed screenshots: they must stay where the image puts them
const PHYSICAL_ON_PURPOSE = new Set([join('src', 'components', 'info', 'GuideClip.tsx')]);

const VALUE = String.raw`(?:\d+(?:\.\d+)?|\d+\/\d+|px|auto|full|\[[^\]\s]+\])`;
const PHYSICAL = new RegExp(
  String.raw`(?<=^|[\s"'\`{(])(?:[a-z0-9-]+:)*-?(?:(?:ml|mr|pl|pr|left|right)-${VALUE}|text-(?:left|right)|rounded-(?:l|r|tl|tr|bl|br)(?:-[a-z0-9]+)?|border-(?:l|r)(?:-[a-z0-9]+)*)(?=$|[\s"'\`})])`,
  'g',
);

const source = files('src')
  .filter((f) => !PHYSICAL_ON_PURPOSE.has(f))
  .map((f) => ({ f, s: readFileSync(f, 'utf8') }));

describe('right-to-left readiness', () => {
  it('uses logical classes instead of left/right', () => {
    const found = source.flatMap(({ f, s }) =>
      [...s.matchAll(PHYSICAL)]
        .map((m) => m[0])
        // left-1/2 with -translate-x-1/2 centres an element, which is the same in both directions
        .filter((c) => !/(^|:)(left|right)-1\/2$/.test(c))
        .map((c) => `${f}: ${c}`),
    );
    expect(found).toEqual([]);
  });

  it('pairs every space-x with rtl:space-x-reverse', () => {
    const missing = source.flatMap(({ f, s }) =>
      [...s.matchAll(/(["'`])([^"'`\n]*\bspace-x-\d[^"'`\n]*)\1/g)]
        .filter((m) => !/\brtl:space-x-reverse\b/.test(m[2]))
        .map((m) => `${f}: ${m[2].trim()}`),
    );
    expect(missing).toEqual([]);
  });

  it('mirrors arrows that point along the line of text', () => {
    const unmirrored = source.flatMap(({ f, s }) =>
      [...s.matchAll(/<(ChevronLeft|ChevronRight|ArrowLeft|ArrowRight|LogOut)\b[^>]*>/g)]
        // rotate-90 turns an arrow to point down, which doesn't mirror
        .filter((m) => !/rtl:-scale-x-100|rotate-90/.test(m[0]))
        .map((m) => `${f}: ${m[0]}`),
    );
    expect(unmirrored).toEqual([]);
  });
});
