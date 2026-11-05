import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { fakeDb, filterValue } from './fakeDb';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
});

// The handlers' sign-in check and database are the service's own; stand them in
const auth = vi.hoisted(() => ({ household: 'h1' as string | null }));
const stand = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('../../scraper/src/supabase-push', () => ({
  getUserAndHousehold: async () => {
    if (!auth.household) throw new Error('Invalid or expired auth token');
    return { userId: 'u1', householdId: auth.household };
  },
  get supabase() {
    return stand.db;
  },
}));

import { encrypt } from '../../scraper/src/encryption';
import { allowSms, allowCheck, resetRateLimits } from '../../scraper/src/rate-limit';
import { loadCalCredentials, NotFoundError } from '../../scraper/src/cal-otp';
import { handleOtpRequest, handleOtpVerify } from '../../scraper/src/cal-handlers';
import { migrateCalIds } from '../../scraper/src/cal-id-migration';

const SECRET = { id: '123456782', last4Digits: '4321' };
const C1 = 'c1c1c1c1-0000-4000-8000-000000000001';

function calDb(rows: Record<string, { household_id: string; provider: string; credentials_encrypted: string | null }>) {
  return fakeDb(q => {
    const row = rows[filterValue(q, 'eq', 'id') as string];
    return { data: row && row.household_id === filterValue(q, 'eq', 'household_id') ? row : null };
  });
}

describe('loadCalCredentials', () => {
  it('decrypts a Cal account’s ID for a member of its household only', async () => {
    const { db, queries } = calDb({ c1: { household_id: 'h1', provider: 'visaCalFast', credentials_encrypted: encrypt(JSON.stringify(SECRET)) } });
    expect(await loadCalCredentials(db, 'h1', 'c1')).toEqual(SECRET);
    expect(filterValue(queries[0], 'eq', 'household_id')).toBe('h1');
    await expect(loadCalCredentials(db, 'h2', 'c1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('refuses accounts that aren’t Cal or hold no server-side ID', async () => {
    const { db } = calDb({
      bank: { household_id: 'h1', provider: 'discount', credentials_encrypted: encrypt('{}') },
      old: { household_id: 'h1', provider: 'visaCalFast', credentials_encrypted: null },
    });
    await expect(loadCalCredentials(db, 'h1', 'bank')).rejects.toBeInstanceOf(NotFoundError);
    await expect(loadCalCredentials(db, 'h1', 'old')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('Cal SMS sign-in through the service', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    auth.household = 'h1';
    stand.db = calDb({ [C1]: { household_id: 'h1', provider: 'visaCalFast', credentials_encrypted: encrypt(JSON.stringify(SECRET)) } }).db;
    resetRateLimits();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('asks Cal for the SMS with the server-held ID, and returns only Cal’s handle', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ token: 'cal-session' }) });
    const res = await handleOtpRequest('Bearer jwt', { connectionId: C1 });
    expect(res).toEqual({ status: 200, body: { calSessionToken: 'cal-session' } });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect([sent.userId, sent.last4Digits]).toEqual([SECRET.id, SECRET.last4Digits]);
    expect(JSON.stringify(res)).not.toContain(SECRET.id);
  });

  it('verifies the code and returns the short-lived token', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ token: 'otp-token' }) });
    const res = await handleOtpVerify('Bearer jwt', { connectionId: C1, calSessionToken: 'cal-session', code: ' 123456 ' });
    expect(res).toEqual({ status: 200, body: { otpToken: 'otp-token' } });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ custID: SECRET.id, password: '123456', token: 'cal-session' });
  });

  it('turns away a caller who isn’t signed in, another household, and incomplete requests', async () => {
    auth.household = null;
    expect((await handleOtpRequest('', { connectionId: C1 })).status).toBe(401);
    auth.household = 'h2';
    expect(await handleOtpRequest('Bearer jwt', { connectionId: C1 })).toEqual({ status: 404, body: { error: 'Account not found' } });
    expect((await handleOtpVerify('Bearer jwt', { connectionId: C1 })).status).toBe(400);
    expect((await handleOtpRequest('Bearer jwt', { connectionId: 'c1' })).status).toBe(400); // not a UUID
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends at most one SMS a minute per account', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ token: 'cal-session' }) });
    expect((await handleOtpRequest('Bearer jwt', { connectionId: C1 })).status).toBe(200);
    expect(await handleOtpRequest('Bearer jwt', { connectionId: C1 })).toEqual({ status: 429, body: { error: 'Too many SMS requests. Try again in a minute.' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('allows five tries per code', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ message: 'wrong code' }) });
    for (let i = 0; i < 5; i++) {
      expect(await handleOtpVerify('Bearer jwt', { connectionId: C1, calSessionToken: 'cs', code: '000000' })).toEqual({ status: 400, body: { error: 'OTP verification failed: wrong code' } });
    }
    expect((await handleOtpVerify('Bearer jwt', { connectionId: C1, calSessionToken: 'cs', code: '000000' })).status).toBe(429);
  });

  it('never passes database or decryption errors to the browser', async () => {
    stand.db = calDb({ [C1]: { household_id: 'h1', provider: 'visaCalFast', credentials_encrypted: 'not-a-valid-blob' } }).db;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await handleOtpRequest('Bearer jwt', { connectionId: C1 });
    expect(res).toEqual({ status: 500, body: { error: "Couldn't send the SMS code. Try again." } });
    expect(spy.mock.calls.flat().join(' ')).not.toMatch(/blob|JSON|Unexpected token/i);
    spy.mockRestore();
  });
});

describe('rate limits', () => {
  beforeEach(() => resetRateLimits());

  it('limits SMS per account and per person: one a minute, five an hour', () => {
    const t0 = Date.parse('2026-11-01T10:00:00Z');
    for (let i = 0; i < 5; i++) expect(allowSms(['connection:a', 'user:u'], t0 + i * 61_000)).toBe(true);
    expect(allowSms(['connection:a', 'user:u'], t0 + 5 * 61_000)).toBe(false);
    // The same person on another account is still limited; someone else on it isn't
    expect(allowSms(['connection:b', 'user:u'], t0 + 6 * 61_000)).toBe(false);
    expect(allowSms(['connection:c', 'user:v'], t0 + 6 * 61_000)).toBe(true);
    expect(allowSms(['connection:a', 'user:u'], t0 + 3_600_000 + 1)).toBe(true);
  });

  it('allows five checks per sign-in, on that account', () => {
    for (let i = 0; i < 5; i++) expect(allowCheck('acct', 'cs', 'u1')).toBe(true);
    expect(allowCheck('acct', ' cs ', 'u1')).toBe(false); // the same handle, however it's padded
    expect(allowCheck('other-acct', 'cs', 'u1')).toBe(true);
    expect(allowCheck('acct', 'new-code', 'u1')).toBe(true);
  });

  it('caps a person at twenty checks an hour, across sign-ins', () => {
    const t0 = Date.parse('2026-11-01T10:00:00Z');
    for (let i = 0; i < 20; i++) expect(allowCheck('acct', `cs${Math.floor(i / 5)}`, 'u1', t0 + i)).toBe(true);
    expect(allowCheck('acct', 'fresh', 'u1', t0 + 21)).toBe(false);
    expect(allowCheck('acct', 'fresh', 'u2', t0 + 22)).toBe(true);
    expect(allowCheck('acct', 'fresh', 'u1', t0 + 3_600_001)).toBe(true);
  });
});

describe('migrateCalIds', () => {
  const connections = [
    { id: 'c1', household_id: 'h1', metadata: { id: '123456782', last4Digits: '4321' } },
    { id: 'c2', household_id: 'h1', metadata: { secure: true, last4Digits: '9999' } },
    { id: 'c3', household_id: null, metadata: { id: '999999998', last4Digits: '1111' } },
  ];

  it('dry run: counts the connections to move and changes nothing', async () => {
    const { db, queries } = fakeDb(() => ({ data: connections }));
    expect(await migrateCalIds(db, { apply: false, encrypt })).toEqual({ found: 1, moved: 0, connectionIds: ['c1'], skippedNoHousehold: 1 });
    expect(queries.every(q => q.op === 'select')).toBe(true);
  });

  it('apply: encrypts the ID, drops it from metadata, and only while it’s still there', async () => {
    const { db, queries } = fakeDb(q => (q.op === 'update' ? { data: [{ id: 'c1' }] } : { data: connections }));
    expect(await migrateCalIds(db, { apply: true, encrypt })).toEqual({ found: 1, moved: 1, connectionIds: ['c1'], skippedNoHousehold: 1 });
    expect(queries.filter(q => q.op === 'update')).toHaveLength(1);

    const update = queries.find(q => q.op === 'update')!;
    expect(filterValue(update, 'eq', 'id')).toBe('c1');
    expect(update.filters).toContainEqual(['not', 'metadata->>id', 'is', null]);
    const payload = update.payload as { credentials_encrypted: string; metadata: Record<string, unknown> };
    expect(payload.metadata).toEqual({ last4Digits: '4321', secure: true });
    const { decrypt } = await import('../../scraper/src/encryption');
    expect(JSON.parse(decrypt(payload.credentials_encrypted))).toEqual({ id: '123456782', last4Digits: '4321' });
  });
});
