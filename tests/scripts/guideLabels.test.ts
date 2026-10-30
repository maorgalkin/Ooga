import { describe, it, expect } from 'vitest';
import { DATA, LABEL_KEYS, labels } from '../../scripts/demo/guide-labels.mjs';

// capture-guide.mjs finds buttons and fields by these labels; a missing one breaks the capture
describe('guide capture labels', () => {
  it('has text for every label the capture uses, in both languages', () => {
    for (const lang of ['en', 'he']) {
      const found = labels(lang);
      expect(Object.keys(found)).toEqual(Object.keys(LABEL_KEYS));
      for (const [name, value] of Object.entries(found)) expect(value, `${lang}: ${name}`).not.toBe('');
    }
  });

  it('types the same kinds of demo data in each language', () => {
    expect(Object.keys(DATA.he)).toEqual(Object.keys(DATA.en));
    expect(DATA.he.newCategories).toHaveLength(DATA.en.newCategories.length);
  });
});
