import { describe, it, expect, vi } from 'vitest';
import i18n from '../../src/i18n';

// A Hebrew set that has only some frames, to check each clip falls back to English as a whole
vi.mock('../../src/content/guide-frames.he.json', () => ({
  default: {
    'budget/tab': { src: '/guide/he/budget/tab.webp', size: { w: 1280, h: 800 } },
    'budget/defaults': { src: '/guide/he/budget/defaults.webp', size: { w: 1280, h: 800 } },
    // Only one of the two frames of the "invite your partner" clip
    'household/invite': { src: '/guide/he/household/invite.webp', size: { w: 400, h: 600 } },
  },
}));
vi.mock('../../src/content/guide-frames.he.mobile.json', () => ({ default: {} }));

import { localizeGuide } from '../../src/content/guide';

const step = (guide: ReturnType<typeof localizeGuide>, slug: string, id: string) =>
  guide.chapters.find((c) => c.slug === slug)!.steps.find((s) => s.id === id)!;

describe('guide screenshots per language', () => {
  const hebrew = localizeGuide(i18n.getFixedT('he', 'guide'), 'he');
  const english = localizeGuide(i18n.getFixedT('en', 'guide'), 'en');

  it('shows the Hebrew frames in Hebrew when the set has the whole clip', () => {
    expect(step(hebrew, 'budget', 'start').clip!.frames.map((f) => f.src)).toEqual([
      '/guide/he/budget/tab.webp',
      '/guide/he/budget/defaults.webp',
    ]);
  });

  it('falls back to English for a clip the Hebrew set has only part of, never mixing the two', () => {
    const srcs = step(hebrew, 'household', 'invite-partner').clip!.frames.map((f) => f.src);
    expect(srcs).toEqual(['/guide/household/invite.webp', '/guide/household/switch.webp']);
  });

  it('keeps the English phone frames when there are no Hebrew ones', () => {
    expect(step(hebrew, 'budget', 'start').clip!.mobileFrames?.[0].src).toBe('/guide/mobile/budget/tab.webp');
  });

  it('shows English readers the English frames', () => {
    expect(step(english, 'budget', 'start').clip!.frames[0].src).toBe('/guide/budget/tab.webp');
  });
});
