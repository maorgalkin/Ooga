import { describe, it, expect } from 'vitest';
import { isBankProvider, isCardBillPayment, makeBankExternalId } from '../../scraper/src/bank-rules';

describe('isCardBillPayment', () => {
  it.each([
    'כרטיסי אשראי-י',
    'כרטיס אשראי',
    'כאל',
    'ויזה כאל',
    'ישראכרט בע"מ',
    'מקס איט פיננסים',
    'לאומי קארד',
    'אמריקן אקספרס',
    'דיינרס קלוב',
    'VISA CAL',
    'Isracard',
  ])('skips the card bill line "%s"', description => {
    expect(isCardBillPayment(description)).toBe(true);
  });

  it.each([
    'משכורת',
    'כרטיס דביט',
    'מקס סטוק',
    'העברה לחשבון',
    'משיכת מזומן',
    'כאלה ואחרים', // "כאל" inside a longer Hebrew word
    'הוראת קבע - חברת חשמל',
    '',
  ])('keeps "%s"', description => {
    expect(isCardBillPayment(description)).toBe(false);
  });
});

describe('isBankProvider', () => {
  it('recognises checking-account providers only', () => {
    expect(isBankProvider('discount')).toBe(true);
    expect(isBankProvider('hapoalim')).toBe(true);
    expect(isBankProvider('visaCal')).toBe(false);
    expect(isBankProvider('isracard')).toBe(false);
  });
});

describe('makeBankExternalId', () => {
  const withdrawal = { date: '2026-09-20T00:00:00.000Z', chargedAmount: -200, description: 'משיכת מזומן' };

  it('keeps two identical same-day transactions apart by operation number', () => {
    const first = makeBankExternalId('discount', '0123456', { ...withdrawal, identifier: 101 });
    const second = makeBankExternalId('discount', '0123456', { ...withdrawal, identifier: 102 });
    expect(first).not.toBe(second);
  });

  it('is stable for the same transaction and scoped to the account', () => {
    const tx = { ...withdrawal, identifier: 101 };
    expect(makeBankExternalId('discount', '0123456', tx)).toBe(makeBankExternalId('discount', '0123456', tx));
    expect(makeBankExternalId('discount', '0123456', tx)).not.toBe(makeBankExternalId('discount', '9999999', tx));
  });
});
