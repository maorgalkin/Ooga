// Captures the Getting started guide's screenshots from the demo household.
//
//   node scripts/demo/capture-guide.mjs <phase> [--mobile] [--lang he]
//
// Needs the dev server from scripts/demo/dev-against-test.mjs on :5174 and the demo sign-in
// from seed-demo-household.ts. Phases run in order because the early ones create data the
// later ones show: signed-out → household → budget → transactions → (seed history) → tour.
// Each frame is written to public/guide/<chapter>/<name>.webp and its pointer/highlight
// boxes (percentages of the frame) to src/content/guide-frames.json, which the guide reads.
// --mobile captures the phone set instead: a 390×844 touch screen, written to
// public/guide/mobile/ and src/content/guide-frames.mobile.json under the same keys.
// --lang he captures the Hebrew app into public/guide/he/ (and he/mobile/) and
// src/content/guide-frames.he.json (and .he.mobile.json), again under the same keys; the
// demo household must be seeded with --lang he.
// Full refresh procedure: docs/GUIDE_SCREENSHOTS.md.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { parse } from 'dotenv';
import { testProject } from './guard.mjs';
import { DATA, labels } from './guide-labels.mjs';

const require = createRequire(new URL('../../scraper/package.json', import.meta.url));
const puppeteer = require('puppeteer-core');

const BASE = 'http://localhost:5174';
const MOBILE = process.argv.includes('--mobile');
const langAt = process.argv.indexOf('--lang');
const LANG = langAt > -1 ? process.argv[langAt + 1] : 'en';
if (!DATA[LANG]) throw new Error(`Unknown --lang ${LANG}; use en or he.`);
// The labels to click and the data to type, in the language being captured
const L = labels(LANG);
const D = DATA[LANG];
const VIEW = MOBILE ? { width: 390, height: 844 } : { width: 1280, height: 800 };
// A phone frame taller than this is cropped around its target, so a clip fits on a phone screen
const MAX_MOBILE_HEIGHT = Math.round(VIEW.width * 1.4);
const SET = LANG === 'en' ? '' : `${LANG}/`;
const OUT = `guide/${SET}${MOBILE ? 'mobile' : ''}`.replace(/\/$/, '');
const MANIFEST = `src/content/guide-frames${LANG === 'en' ? '' : `.${LANG}`}${MOBILE ? '.mobile' : ''}.json`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  userDataDir: 'node_modules/.cache/ooga-guide-chrome', // keeps the demo session between phases
  args: ['--force-color-profile=srgb'],
});
const page = await browser.newPage();
await page.setViewport(MOBILE ? { ...VIEW, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { ...VIEW, deviceScaleFactor: 1.5 });
await page.emulateMediaFeatures([
  { name: 'prefers-color-scheme', value: 'light' },
]);
// The app reads its language from here before it starts; set on every load, so a leftover
// choice from another run can't leak in
await page.evaluateOnNewDocument((lang) => {
  try { localStorage.setItem('ooga.language', lang); } catch { /* about:blank */ }
}, LANG);
page.on('pageerror', (e) => console.log(`page error: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && console.log(`console error: ${m.text().slice(0, 200)}`));
page.on('dialog', (d) => {
  console.log(`dialog (${d.type()}): ${d.message()}`);
  d.dismiss();
});

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// Quoted, because labels can hold parentheses ("ויזה כאל (קוד ב־SMS)")
const text = (t) => `::-p-text(${JSON.stringify(t)})`;
// On phones the top bar shows only the + icon
const ADD = MOBILE ? 'nav button:has(.lucide-plus)' : `nav ${text(L.addTransaction)}`;

// The Dashboard shows pulsing placeholder tiles until its data arrives; never capture those
async function settled() {
  await page.waitForFunction(
    (label) => !document.querySelector(`[role=status][aria-label=${JSON.stringify(label)}]`),
    { timeout: 20000 },
    L.dashboardLoading,
  );
}

async function go(path) {
  await page.goto(BASE + path, { waitUntil: 'networkidle0' });
  // The build-info footer (branch, commit, build time) would date every screenshot
  await page.addStyleTag({ content: 'div.font-mono.border-t { display: none !important; }' });
  await settled();
  await pause(600);
}

async function click(selector) {
  const el = await page.waitForSelector(selector, { visible: true, timeout: 10000 });
  await el.click();
  await pause(700);
}

async function type(selector, value, { clear = true } = {}) {
  const el = await page.waitForSelector(selector, { visible: true });
  if (clear) await el.click({ clickCount: 3 });
  await el.type(String(value));
}

async function box(selector) {
  const el = selector && (await page.$(selector));
  return el ? el.boundingBox() : null;
}

/**
 * Saves one frame. `area` crops to an element (with padding); `target` is the control the
 * frame is about: it gets the pointer and, with `ring`, a highlight. `focus` keeps an element in a
 * cropped phone frame without pointing at it.
 */
async function shot(chapter, name, { area, target, focus, ring = true, pad = 24 } = {}) {
  mkdirSync(`public/${OUT}/${chapter}`, { recursive: true });
  let clip = { x: 0, y: 0, ...VIEW };
  const areaBox = await box(area);
  if (areaBox) {
    const x = Math.max(0, areaBox.x - pad);
    const y = Math.max(0, areaBox.y - pad);
    clip = { x, y, width: Math.min(VIEW.width - x, areaBox.width + pad * 2), height: Math.min(VIEW.height - y, areaBox.height + pad * 2) };
  }
  const t = await box(target);
  const keep = (await box(focus)) ?? t;
  if (MOBILE && clip.height > MAX_MOBILE_HEIGHT) {
    // Keep the target in view: centre the crop on it, else keep the top of the screen
    const centre = keep ? keep.y + keep.height / 2 : clip.y;
    const top = Math.min(Math.max(clip.y, centre - MAX_MOBILE_HEIGHT / 2), clip.y + clip.height - MAX_MOBILE_HEIGHT);
    clip = { ...clip, y: keep ? top : clip.y, height: MAX_MOBILE_HEIGHT };
  }
  // Boxes are viewport-relative but a screenshot clip is page-relative
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  await page.screenshot({
    path: `public/${OUT}/${chapter}/${name}.webp`,
    type: 'webp',
    quality: 82,
    clip: { ...clip, x: clip.x + scroll.x, y: clip.y + scroll.y },
    // Capturing beyond the viewport resizes the page, which re-lays out the Dashboard mid-shot
    captureBeyondViewport: false,
  });

  const frame = { src: `/${OUT}/${chapter}/${name}.webp`, size: { w: Math.round(clip.width), h: Math.round(clip.height) } };
  if (t) {
    const pct = (v, origin, size) => Math.round(((v - origin) / size) * 1000) / 10;
    frame.pointer = { x: pct(t.x + t.width / 2, clip.x, clip.width), y: pct(t.y + t.height / 2, clip.y, clip.height) };
    // A target scrolled out of the crop gets no pointer rather than one off the edge
    if (frame.pointer.x < 0 || frame.pointer.x > 100 || frame.pointer.y < 0 || frame.pointer.y > 100) {
      console.log(`  target outside ${chapter}/${name}; no pointer`);
      manifest[`${chapter}/${name}`] = { src: frame.src, size: frame.size };
      return;
    }
    if (ring) {
      frame.highlight = {
        x: pct(t.x - 4, clip.x, clip.width),
        y: pct(t.y - 4, clip.y, clip.height),
        w: pct(clip.x + t.width + 8, clip.x, clip.width),
        h: pct(clip.y + t.height + 8, clip.y, clip.height),
      };
    }
  }
  manifest[`${chapter}/${name}`] = frame;
  console.log('captured', `${chapter}/${name}`);
}

async function signIn() {
  const demo = parse(readFileSync('.env.demo.local'));
  await go('/login');
  if (!page.url().includes('/login')) return;
  await type('#email', demo.DEMO_EMAIL);
  await type('#password', demo.DEMO_PASSWORD);
  await click('button[type=submit]');
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 15000 });
  await pause(1500);
  // The server on :5174 must be talking to the test project, or stop before capturing anything
  const sessionKey = `sb-${testProject().ref}-auth-token`;
  if (!(await page.evaluate((key) => localStorage.getItem(key) !== null, sessionKey))) {
    throw new Error('The app on :5174 is not using the test project. Start it with scripts/demo/dev-against-test.mjs.');
  }
}

// Marks the dialog panel around `selector` so a shot can crop to it, whatever the modal's markup.
const PANEL = '[data-capture=panel]';
async function markPanel(selector) {
  const el = await page.waitForSelector(selector, { visible: true, timeout: 10000 });
  await page.evaluate((node) => {
    document.querySelectorAll('[data-capture]').forEach((n) => n.removeAttribute('data-capture'));
    let panel = node;
    // The dialog panel is the nearest width-capped box, or failing that the overlay's child
    while (panel.parentElement && !/\bmax-w-/.test(panel.className) && !panel.parentElement.classList.contains('fixed')) {
      panel = panel.parentElement;
    }
    panel.setAttribute('data-capture', 'panel');
  }, el);
}

async function waitText(t) {
  await page.waitForSelector(text(t), { visible: true, timeout: 15000 });
  await pause(500);
}

async function tab(name) {
  await click(`nav ${text(name)}`).catch(() => click(`button${text(name)}`));
  await settled();
  await pause(1200);
}

const phases = {
  async 'signed-out'() {
    await go('/register');
    await page.evaluate(() => localStorage.clear());
    await go('/register');
    const card = '.max-w-md';
    await shot('household', 'register-1', { area: card, target: '#firstName', ring: false });
    await type('#firstName', D.firstName);
    await type('#lastName', D.lastName);
    await shot('household', 'register-2', { area: card, target: '#email', ring: false });
    await type('#email', 'dana@example.com');
    await type('#password', 'demo-only');
    await type('#confirmPassword', 'demo-only');
    await shot('household', 'register-3', { area: card, target: 'button[type=submit]' });
  },

  async household() {
    await signIn();
    await go('/');
    await waitText(L.manageHousehold);
    await shot('household', 'dashboard-empty', { target: text(L.manageHousehold) });
    await click(text(L.manageHousehold));
    await waitText(L.owner);
    await markPanel(text(L.householdSettings));
    await shot('household', 'settings', { area: PANEL, target: text(L.edit), pad: 0 });
    await click(text(L.edit));
    await type(`${PANEL} input`, D.householdName);
    await shot('household', 'rename', { area: PANEL, target: `${PANEL} input`, pad: 0 });
    await page.keyboard.press('Enter');
    await pause(1500);
    await shot('household', 'members', { area: PANEL, target: text(L.addMember), pad: 0 });
    await page.$eval(text(L.switchHouseholds), (el) => el.scrollIntoView({ block: 'end' }));
    await pause(400);
    await shot('household', 'invite', { area: PANEL, target: text(L.copy), pad: 0 });
    await shot('household', 'switch', { area: PANEL, target: text(L.switchHouseholds), pad: 0 });
  },

  async budget() {
    await signIn();
    await go('/');
    await tab(L.budgetTab);
    await waitText(L.createBudget);
    await shot('budget', 'tab', { target: text(L.createBudget) });
    await click(text(L.createBudget));
    const budgetName = `input[placeholder=${JSON.stringify(L.budgetNamePlaceholder)}]`;
    await type(budgetName, D.budgetName);
    await shot('budget', 'defaults', { target: budgetName });

    await click(text(L.groceries));
    await markPanel('input[type=color]');
    await type(`${PANEL} input[type=number]`, 3200);
    await shot('budget', 'edit-category', { area: PANEL, target: `${PANEL} input[type=number]`, pad: 0 });
    await click(`${PANEL} ${text(L.saveCategory)}`);

    const categoryName = `input[placeholder=${JSON.stringify(L.categoryNamePlaceholder)}]`;
    for (const [i, [name, limit]] of D.newCategories.entries()) {
      await click(text(L.clickToCreate));
      await markPanel(categoryName);
      await type(categoryName, name);
      await type('input[placeholder="500"]', limit);
      if (i === 0) await shot('budget', 'add-category', { area: PANEL, target: `${PANEL} button.bg-blue-600`, pad: 0 });
      await click(`${PANEL} button.bg-blue-600`);
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await pause(500);
    await shot('budget', 'save', { target: text(L.saveBudget) });
    await click(text(L.saveBudget));
    await waitText(L.remaining);
    await pause(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('budget', 'saved');
  },

  async transactions() {
    await signIn();
    await go('/');
    await shot('transactions', 'open', { target: ADD });
    await click(ADD);
    await markPanel(text(L.choose));
    await shot('transactions', 'modal', { area: PANEL, target: text(L.choose), pad: 0 });
    await click(text(L.choose));
    await pause(500);
    await markPanel(`h3${text(L.selectExpenseCategory)}`);
    await shot('transactions', 'categories', { area: PANEL, target: `${PANEL} ${text(L.groceries)}`, pad: 0 });
    await click(`${PANEL} ${text(L.groceries)}`);
    await markPanel(text(L.choose));
    await type(`input[placeholder=${JSON.stringify(L.descriptionPlaceholder)}]`, D.description);
    await type('input[placeholder="0.00"]', 412);
    await page.select(`${PANEL} select`, await page.$eval(`${PANEL} select option:nth-child(2)`, (o) => o.value));
    await shot('transactions', 'filled', { area: PANEL, target: `${PANEL} button[type=submit]`, pad: 0 });
    await click(`${PANEL} ${text(L.incomeToggle)}`);
    await shot('transactions', 'income', { area: PANEL, target: `${PANEL} ${text(L.incomeToggle)}`, pad: 0 });
    await click(`${PANEL} button${text(L.expenseToggle)}`);
    await click(`${PANEL} ${text(L.choose)}`);
    await markPanel(`h3${text(L.selectExpenseCategory)}`);
    await click(`${PANEL} ${text(L.groceries)}`);
    await markPanel(text(L.choose));
    await type('input[placeholder="0.00"]', 412);
    const months = `input[placeholder=${JSON.stringify(L.monthsPlaceholder)}]`;
    await page.evaluate((sel) => document.querySelector(`[data-capture=panel] ${sel}`)?.scrollIntoView(), months);
    await click(`${PANEL} ${text(L.installments)}`);
    await type(months, 6).catch(() => {});
    await shot('transactions', 'installments', { area: PANEL, target: months, pad: 0 });
    await page.keyboard.press('Escape');
    await go('/');

    await tab(L.budgetTab);
    await click(text(L.settingsTab));
    await waitText(L.connectedAccounts);
    await page.evaluate((t) => [...document.querySelectorAll('h2,h3')].find((h) => h.textContent?.includes(t))?.scrollIntoView({ block: 'center' }), L.connectedAccounts);
    await pause(500);
    await shot('transactions', 'accounts', { target: text(L.addAccount) });
    await click(text(L.addAccount));
    await markPanel(text(L.discountBank));
    await shot('transactions', 'providers', { area: PANEL, target: `${PANEL} ${text(L.visaCal)}`, pad: 0 });
  },

  async tour() {
    await signIn();
    await go('/');
    await pause(3000);
    await shot('insights', 'dashboard');
    await page.evaluate(() => window.scrollBy(0, 420));
    await pause(1500);
    await shot('insights', 'dashboard-chart');
    await page.evaluate(() => window.scrollTo(0, 0));
    await tab(L.transactionsTab);
    await shot('transactions', 'list', { target: `button[title=${JSON.stringify(L.editTransaction)}]` });
    await tab(L.budgetTab);
    await pause(1500);
    await shot('update-budget', 'overview');
    await click(text(L.categoriesTab));
    await pause(1000);
    await shot('update-budget', 'categories', { target: text(L.edit) });
    await click(text(L.edit));
    await markPanel(text(L.detailsTab));
    await shot('update-budget', 'details', { area: PANEL, target: `${PANEL} ${text(L.monthlyLimit)}`, pad: 0 });
    await click(`${PANEL} button${text(L.adjustTab)}`);
    await shot('update-budget', 'adjust', { area: PANEL, target: `${PANEL} ${text(L.newLimit)}`, pad: 0 });
    await click(`${PANEL} button${text(L.mergeTab)}`);
    await shot('update-budget', 'merge', { area: PANEL, target: `${PANEL} select`, pad: 0 });
    await page.keyboard.press('Escape');
    await go('/');
    await tab(L.budgetTab);
    await click(text(L.settingsTab));
    await waitText(L.budgetHistory);
    await page.evaluate((t) => [...document.querySelectorAll('h2,h3')].find((h) => h.textContent?.includes(t))?.scrollIntoView({ block: 'start' }), L.budgetHistory);
    await pause(500);
    await shot('update-budget', 'history', { focus: text(L.budgetHistorySubtitle) });

    await tab(L.insightsTab);
    await pause(3000);
    await shot('insights', 'range', { target: text(L.currentMonth) });
    for (const [title, name] of [
      [L.budgetSummary, 'summary'],
      [L.performanceTitle, 'chart'],
      [L.accuracyTitle, 'accuracy'],
      [L.paceTitle, 'pace'],
      [L.membersTitle, 'members'],
    ]) {
      await page.evaluate((t) => [...document.querySelectorAll('h2,h3')].find((h) => h.textContent?.includes(t))?.scrollIntoView({ block: 'start' }), title);
      await page.evaluate(() => window.scrollBy(0, -80));
      await pause(900);
      await shot('insights', name);
    }
  },
};

const phase = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!phases[phase]) {
  console.error(`Usage: node scripts/demo/capture-guide.mjs <${Object.keys(phases).join('|')}>`);
  process.exit(1);
}
try {
  await phases[phase]();
} finally {
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  await browser.close();
}
