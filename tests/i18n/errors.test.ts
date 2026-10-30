import { describe, it, expect, vi, afterEach } from 'vitest';
import i18n from '../../src/i18n';
import { errorMessage } from '../../src/i18n/errors';

const en = i18n.getFixedT('en');
const he = i18n.getFixedT('he');

describe('errorMessage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('puts messages services throw on purpose into the reader\'s words', () => {
    const err = new Error('Owner cannot leave household. Transfer ownership first or delete the household.');
    expect(errorMessage(err, en, 'household.leave.failed')).toBe(
      "The owner can't leave the household. Make someone else the owner first, or delete the household.",
    );
    expect(errorMessage(err, he, 'household.leave.failed')).toBe(
      'הבעלים לא יכולים לעזוב את משק הבית. קודם מעבירים את הבעלות למישהו אחר, או מוחקים את משק הבית.',
    );
  });

  it('recognises import server and Visa Cal failures', () => {
    expect(errorMessage(new Error('The import service is unreachable. Try again in a minute.'), he, 'import.failed')).toBe(
      'שירות הייבוא לא זמין כרגע. כדאי לנסות שוב בעוד דקה.',
    );
    expect(errorMessage(new Error('OTP verification failed: bad code'), en, 'import.failed')).toBe(
      "That code didn't work. Check the SMS and try again.",
    );
    expect(errorMessage(new Error('Discount: Invalid password'), he, 'import.failed')).toBe(
      'הבנק לא קיבל את פרטי ההתחברות. כדאי לבדוק אותם בחשבונות המקושרים ולנסות שוב.',
    );
  });

  it('falls back to the screen\'s own sentence for anything else, including non-errors', () => {
    expect(errorMessage(new Error('Failed to create category: connection reset'), en, 'categories.add.errors.createFailed')).toBe(
      en('categories.add.errors.createFailed'),
    );
    expect(errorMessage(undefined, he, 'import.failed')).toBe(he('import.failed'));
    expect(errorMessage('Invalid invitation code', en, 'household.join.joinFailed')).toBe(
      "That invitation code doesn't work. Check it, or ask for a new one.",
    );
  });

  it('logs the original message with long digit runs masked', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    errorMessage(new Error('OTP request failed: id 123456789 card 4580'), en, 'import.failed');
    const logged = log.mock.calls.flat().join(' ');
    expect(logged).toContain('OTP request failed');
    expect(logged).not.toMatch(/\d{4,}/);
  });

  it('masks numbers written in groups, and reads plain-object errors', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Supabase can hand back a plain object rather than an Error
    expect(errorMessage({ message: 'duplicate key value violates unique constraint' }, en, 'import.failed')).toBe(
      en('errors.duplicateName'),
    );
    errorMessage(new Error('login failed for 123-456-789, card 4580 1234 5678 9012'), en, 'import.failed');
    const logged = log.mock.calls.flat().join(' ');
    expect(logged).toContain('duplicate key value');
    expect(logged).not.toMatch(/\d[\s-]?\d[\s-]?\d[\s-]?\d/);
  });
});
