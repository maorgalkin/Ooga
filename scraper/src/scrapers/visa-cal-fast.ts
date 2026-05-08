/**
 * VisaCalFastScraper — Visa Cal "fast access" login (ID + last 4 card digits + SMS OTP)
 *
 * Extends VisaCalScraper, overriding only `login()`.
 * After a successful login the inherited `fetchData()` handles all transaction retrieval.
 *
 * SELECTOR NOTES (may need adjustment based on actual cal-online.co.il DOM):
 *   - Fast-access tab:  '#quick-login'               (analogous to '#regular-login')
 *   - National ID:      '[formcontrolname="tz"]'
 *   - Last 4 digits:    '[formcontrolname="last4Digits"]'  (fallback: 'creditCard')
 *   - OTP input:        '[formcontrolname="code"]'         (fallback: 'otp', 'verificationCode')
 *
 * If login fails, open DevTools on https://www.cal-online.co.il, click the fast-access
 * tab and inspect the form elements to verify / update these selectors.
 */

import { createRequire } from 'module';
import type { ScraperOptions, ScraperScrapingResult } from 'israeli-bank-scrapers/lib/scrapers/interface.js';

// israeli-bank-scrapers is CJS. In an ESM context the default import gets double-wrapped:
//   import X from '...'  →  X === { default: VisaCalScraper }   (not the class)
// createRequire bypasses ESM interop and returns the CJS export directly.
const _require = createRequire(import.meta.url);
const _mod = _require('israeli-bank-scrapers/lib/scrapers/visa-cal.js');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const VisaCalScraper: any = _mod.default ?? _mod;
import { ScraperErrorTypes } from 'israeli-bank-scrapers/lib/scrapers/errors.js';
import {
  waitUntilElementFound,
  clickButton,
  fillInput,
} from 'israeli-bank-scrapers/lib/helpers/elements-interactions.js';
import {
  waitForNavigation,
  getCurrentUrl,
} from 'israeli-bank-scrapers/lib/helpers/navigation.js';
import { waitUntil } from 'israeli-bank-scrapers/lib/helpers/waiting.js';

export type VisaCalFastCredentials = {
  id: string;
  last4Digits: string;
};

// Duplicated from visa-cal.js (module-private constants)
const LOGIN_URL = 'https://www.cal-online.co.il/';
const SSO_AUTHORIZATION_REQUEST_ENDPOINT =
  'https://connect.cal-online.co.il/col-rest/calconnect/authentication/SSO';

// Ordered candidates to try for each dynamic selector
const FAST_ACCESS_TAB_SELECTORS = ['#quick-login'];
const LAST4_SELECTORS = ['[formcontrolname="last4Digits"]', '[formcontrolname="creditCard"]'];
const OTP_SELECTORS = [
  '[formcontrolname="code"]',
  '[formcontrolname="otp"]',
  '[formcontrolname="verificationCode"]',
];

async function getLoginFrame(page: any): Promise<any> {
  let frame: any = null;
  await waitUntil(
    () => {
      frame = page.frames().find((f: any) => f.url().includes('connect')) || null;
      return Promise.resolve(!!frame);
    },
    'wait for Cal login iframe',
    10_000,
    500,
  );
  if (!frame) throw new Error('Could not find Cal login iframe (URL containing "connect")');
  return frame;
}

/** Try selectors in order; return the first that resolves, or throw with a helpful message. */
async function findSelector(
  frame: any,
  candidates: string[],
  description: string,
  timeoutPerSelector = 3000,
): Promise<string> {
  for (const sel of candidates) {
    try {
      await waitUntilElementFound(frame, sel, false, timeoutPerSelector);
      return sel;
    } catch {
      // try next
    }
  }
  throw new Error(
    `Could not find ${description}. Tried: ${candidates.join(', ')}. ` +
      'Open DevTools on cal-online.co.il and update the selectors in visa-cal-fast.ts.',
  );
}

export class VisaCalFastScraper extends (VisaCalScraper as new (...args: any[]) => any) {
  private readonly requestOtp: () => Promise<string>;

  constructor(options: ScraperOptions, requestOtp: () => Promise<string>) {
    super(options);
    this.requestOtp = requestOtp;
  }

  /**
   * Override login() entirely.
   * scrape() (base class) calls initialize() → login() → fetchData().
   * We only need to return { success: true } after a successful login;
   * fetchData() (inherited from VisaCalScraper) handles all transaction retrieval.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async login(credentials: any): Promise<ScraperScrapingResult> {
    const creds = credentials as VisaCalFastCredentials;
    const page = (this as any).page;
    if (!page) {
      return { success: false, errorMessage: 'Browser page not initialized', errorType: ScraperErrorTypes.General };
    }

    try {
      // Start intercepting the SSO auth request immediately — must be set BEFORE navigation
      const authRequestPromise = page
        .waitForRequest(SSO_AUTHORIZATION_REQUEST_ENDPOINT, { timeout: 120_000 })
        .catch((e: Error) => {
          console.error('[VisaCalFast] SSO auth request not captured:', e.message);
          return undefined;
        });

      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      );

      // Navigate to the CAL homepage
      await page.goto(LOGIN_URL, { waitUntil: 'load' });

      // Open the login popup
      await waitUntilElementFound(page, '#ccLoginDesktopBtn', true);
      await clickButton(page, '#ccLoginDesktopBtn');

      // Get the login iframe
      const frame = await getLoginFrame(page);

      // Click the fast-access tab (כניסה מהירה)
      const tabSel = await findSelector(frame, FAST_ACCESS_TAB_SELECTORS, 'fast-access tab');
      await clickButton(frame, tabSel);

      // Fill National ID
      await waitUntilElementFound(frame, '[formcontrolname="tz"]');
      await fillInput(frame, '[formcontrolname="tz"]', creds.id);

      // Fill last 4 digits of card
      const last4Sel = await findSelector(frame, LAST4_SELECTORS, 'last-4-digits field');
      await fillInput(frame, last4Sel, creds.last4Digits);

      // Submit
      await clickButton(frame, 'button[type="submit"]');

      // Detect OTP screen (up to 8 s for the Angular SPA to transition)
      let otpSel: string | null = null;
      try {
        otpSel = await findSelector(frame, OTP_SELECTORS, 'OTP input', 8000);
      } catch {
        // No OTP step required — continue to dashboard
      }

      if (otpSel) {
        console.log(`[VisaCalFast] OTP screen detected (${otpSel}), waiting for user input`);
        const otpCode = await this.requestOtp();
        await fillInput(frame, otpSel, otpCode);
        await clickButton(frame, 'button[type="submit"]');
      }

      // Wait for navigation to the dashboard
      try {
        await waitForNavigation(page);
        const currentUrl = await getCurrentUrl(page);
        if (typeof currentUrl === 'string' && currentUrl.includes('site-tutorial')) {
          await clickButton(page, 'button.btn-close');
        }
      } catch (e) {
        const currentUrl = await getCurrentUrl(page);
        if (typeof currentUrl === 'string' && currentUrl.includes('dashboard')) {
          // Navigation error but we're already on the dashboard — treat as success
        } else {
          throw e;
        }
      }

      // Capture auth token from the intercepted SSO request
      const request = await authRequestPromise;
      if (request) {
        (this as any).authorization = String(request.headers().authorization ?? '').trim();
      }

      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      console.error('[VisaCalFast] Login error:', msg);
      return { success: false, errorMessage: msg, errorType: ScraperErrorTypes.General };
    }
  }
}
