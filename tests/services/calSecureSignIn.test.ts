import { describe, it, expect, vi, beforeEach } from 'vitest';

const server = vi.hoisted(() => ({ request: vi.fn(), verify: vi.fn() }));
const browser = vi.hoisted(() => ({ request: vi.fn(), verify: vi.fn(), importTx: vi.fn() }));

vi.mock('../../src/services/scraperService', () => ({
  requestCalOtpViaServer: server.request,
  verifyCalOtpViaServer: server.verify,
}));
vi.mock('../../src/services/calDirectService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/services/calDirectService')>()),
  requestCalOtp: browser.request,
  verifyCalOtp: browser.verify,
  importCalTransactions: browser.importTx,
}));

import { requestCalOtpForConnection, importCalDirect, type BankConnection } from '../../src/services/bankImportService';

const conn = (metadata: Record<string, unknown>): BankConnection =>
  ({ id: 'c1', user_id: 'u1', provider: 'visaCalFast', display_name: 'Cal', last_sync_at: null, is_active: true, created_at: '', metadata }) as BankConnection;
const period = { type: 'current_month' } as const;

describe('Cal sign-in', () => {
  beforeEach(() => {
    for (const fn of [...Object.values(server), ...Object.values(browser)]) fn.mockReset();
    server.request.mockResolvedValue('cal-session');
    server.verify.mockResolvedValue('otp-token');
    browser.request.mockResolvedValue('cal-session');
    browser.verify.mockResolvedValue('otp-token');
    browser.importTx.mockResolvedValue({ dbSessionId: 's1', mode: 'staged', imported: 1, updated: 0, skipped: 0, duplicates: [] });
  });

  it('goes through the import service when it holds the ID: the browser never has it', async () => {
    const secure = conn({ secure: true, last4Digits: '4321' });
    expect(await requestCalOtpForConnection(secure)).toBe('cal-session');
    await importCalDirect(secure, 'cal-session', '123456', period);

    expect(server.request).toHaveBeenCalledWith('c1');
    expect(server.verify).toHaveBeenCalledWith('c1', 'cal-session', '123456');
    expect(browser.request).not.toHaveBeenCalled();
    expect(browser.verify).not.toHaveBeenCalled();
    // Transactions are still fetched in the browser, with the short-lived token
    expect(browser.importTx).toHaveBeenCalledWith('c1', 'otp-token', period, undefined);
  });

  it('keeps an account whose ID hasn’t moved yet working from its metadata', async () => {
    const older = conn({ id: '123456782', last4Digits: '4321' });
    await requestCalOtpForConnection(older);
    await importCalDirect(older, 'cal-session', '123456', period);

    expect(browser.request).toHaveBeenCalledWith('123456782', '4321');
    expect(browser.verify).toHaveBeenCalledWith('123456782', 'cal-session', '123456');
    expect(server.request).not.toHaveBeenCalled();
  });
});
