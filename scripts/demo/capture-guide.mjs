// Captures the Getting started guide's screenshots from the demo household.
//
//   node scripts/demo/capture-guide.mjs <phase>
//
// Needs the dev server from scripts/demo/dev-against-test.mjs on :5174 and the demo sign-in
// from seed-demo-household.ts. Phases run in order because the early ones create data the
// later ones show: signed-out → household → budget → transactions → (seed history) → tour.
// Each frame is written to public/guide/<chapter>/<name>.webp and its pointer/highlight
// boxes (percentages of the frame) to src/content/guide-frames.json, which the guide reads.
// Full refresh procedure: docs/GUIDE_SCREENSHOTS.md.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { parse } from 'dotenv';
import { testProject } from './guard.mjs';

const require = createRequire(new URL('../../scraper/package.json', import.meta.url));
const puppeteer = require('puppeteer-core');

const BASE = 'http://localhost:5174';
const MANIFEST = 'src/content/guide-frames.json';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  userDataDir: 'node_modules/.cache/ooga-guide-chrome', // keeps the demo session between phases
  args: ['--force-color-profile=srgb'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1.5 });
await page.emulateMediaFeatures([
  { name: 'prefers-color-scheme', value: 'light' },
]);
page.on('pageerror', (e) => console.log(`page error: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && console.log(`console error: ${m.text().slice(0, 200)}`));
page.on('dialog', (d) => {
  console.log(`dialog (${d.type()}): ${d.message()}`);
  d.dismiss();
});

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (t) => `::-p-text(${t})`;

async function go(path) {
  await page.goto(BASE + path, { waitUntil: 'networkidle0' });
  // The build-info footer (branch, commit, build time) would date every screenshot
  await page.addStyleTag({ content: 'div.font-mono.border-t { display: none !important; }' });
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
 * frame is about: it gets the pointer and, with `ring`, a highlight.
 */
async function shot(chapter, name, { area, target, ring = true, pad = 24 } = {}) {
  mkdirSync(`public/guide/${chapter}`, { recursive: true });
  const viewport = { x: 0, y: 0, width: 1280, height: 800 };
  let clip = viewport;
  const areaBox = await box(area);
  if (areaBox) {
    clip = {
      x: Math.max(0, areaBox.x - pad),
      y: Math.max(0, areaBox.y - pad),
      width: Math.min(1280, areaBox.width + pad * 2),
      height: Math.min(800, areaBox.height + pad * 2),
    };
  }
  // Boxes are viewport-relative but a screenshot clip is page-relative
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  await page.screenshot({
    path: `public/guide/${chapter}/${name}.webp`,
    type: 'webp',
    quality: 82,
    clip: { ...clip, x: clip.x + scroll.x, y: clip.y + scroll.y },
    // Capturing beyond the viewport resizes the page, which re-lays out the Dashboard mid-shot
    captureBeyondViewport: false,
  });

  const frame = { src: `/guide/${chapter}/${name}.webp`, size: { w: Math.round(clip.width), h: Math.round(clip.height) } };
  const t = await box(target);
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
  await click(`nav ::-p-text(${name})`).catch(() => click(`button::-p-text(${name})`));
  await pause(1200);
}

const phases = {
  async 'signed-out'() {
    await go('/register');
    await page.evaluate(() => localStorage.clear());
    await go('/register');
    const card = '.max-w-md';
    await shot('household', 'register-1', { area: card, target: '#firstName', ring: false });
    await type('#firstName', 'Dana');
    await type('#lastName', 'Levi');
    await shot('household', 'register-2', { area: card, target: '#email', ring: false });
    await type('#email', 'dana@example.com');
    await type('#password', 'demo-only');
    await type('#confirmPassword', 'demo-only');
    await shot('household', 'register-3', { area: card, target: 'button[type=submit]' });
  },

  async household() {
    await signIn();
    await go('/');
    await waitText('Manage household');
    await shot('household', 'dashboard-empty', { target: text('Manage household') });
    await click(text('Manage household'));
    await waitText('Owner');
    await markPanel(text('Household settings'));
    await shot('household', 'settings', { area: PANEL, target: text('Edit'), pad: 0 });
    await click(text('Edit'));
    await type(`${PANEL} input`, 'The Levi family');
    await shot('household', 'rename', { area: PANEL, target: `${PANEL} input`, pad: 0 });
    await page.keyboard.press('Enter');
    await pause(1500);
    await shot('household', 'members', { area: PANEL, target: text('Add member'), pad: 0 });
    await page.$eval(text('Switch households'), (el) => el.scrollIntoView({ block: 'end' }));
    await pause(400);
    await shot('household', 'invite', { area: PANEL, target: text('Copy'), pad: 0 });
    await shot('household', 'switch', { area: PANEL, target: text('Switch households'), pad: 0 });
  },

  async budget() {
    await signIn();
    await go('/');
    await tab('Budget');
    await waitText('Create budget');
    await shot('budget', 'tab', { target: text('Create budget') });
    await click(text('Create budget'));
    await type('input[placeholder="e.g., Summer 2025 Budget"]', 'Family budget');
    await shot('budget', 'defaults', { target: 'input[placeholder="e.g., Summer 2025 Budget"]' });

    await click(text('Groceries'));
    await markPanel('input[type=color]');
    await type(`${PANEL} input[type=number]`, 3200);
    await shot('budget', 'edit-category', { area: PANEL, target: `${PANEL} input[type=number]`, pad: 0 });
    await click(`${PANEL} ::-p-text(Save Changes)`);

    for (const [name, limit] of [['Kids', 1200], ['Dining out', 900]]) {
      await click(text('Click to create new'));
      await markPanel('input[placeholder="e.g., Groceries"]');
      await type('input[placeholder="e.g., Groceries"]', name);
      await type('input[placeholder="500"]', limit);
      if (name === 'Kids') await shot('budget', 'add-category', { area: PANEL, target: `${PANEL} button.bg-blue-600`, pad: 0 });
      await click(`${PANEL} button.bg-blue-600`);
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await pause(500);
    await shot('budget', 'save', { target: text('Save budget') });
    await click(text('Save budget'));
    await waitText('Remaining');
    await pause(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('budget', 'saved');
  },

  async transactions() {
    await signIn();
    await go('/');
    await shot('transactions', 'open', { target: `nav ${text('Add transaction')}` });
    await click(`nav ${text('Add transaction')}`);
    await markPanel(text('Choose'));
    await shot('transactions', 'modal', { area: PANEL, target: text('Choose'), pad: 0 });
    await click(text('Choose'));
    await pause(500);
    await markPanel(text('Select expense category'));
    await shot('transactions', 'categories', { area: PANEL, target: `${PANEL} ${text('Groceries')}`, pad: 0 });
    await click(`${PANEL} ${text('Groceries')}`);
    await markPanel(text('Choose'));
    await type('input[placeholder="Enter transaction description (optional)"]', 'Shufersal weekly shop');
    await type('input[placeholder="0.00"]', 412);
    await page.select(`${PANEL} select`, await page.$eval(`${PANEL} select option:nth-child(2)`, (o) => o.value));
    await shot('transactions', 'filled', { area: PANEL, target: `${PANEL} button[type=submit]`, pad: 0 });
    await click(`${PANEL} ${text('Income')}`);
    await shot('transactions', 'income', { area: PANEL, target: `${PANEL} ${text('Income')}`, pad: 0 });
    await click(`${PANEL} button::-p-text(Expense)`);
    await click(`${PANEL} ${text('Choose')}`);
    await markPanel(text('Select expense category'));
    await click(`${PANEL} ${text('Groceries')}`);
    await markPanel(text('Choose'));
    await type('input[placeholder="0.00"]', 412);
    await page.evaluate(() => document.querySelector('[data-capture=panel] input[placeholder="# months"]')?.scrollIntoView());
    await click(`${PANEL} ${text('installments')}`);
    await type('input[placeholder="# months"]', 6).catch(() => {});
    await shot('transactions', 'installments', { area: PANEL, target: 'input[placeholder="# months"]', pad: 0 });
    await page.keyboard.press('Escape');
    await go('/');

    await tab('Budget');
    await click(text('Settings'));
    await waitText('Connected accounts');
    await page.evaluate(() => [...document.querySelectorAll('h2,h3')].find((h) => h.textContent?.includes('Connected accounts'))?.scrollIntoView({ block: 'center' }));
    await pause(500);
    await shot('transactions', 'accounts', { target: text('Add account') });
    await click(text('Add account'));
    await markPanel(text('Discount Bank'));
    await shot('transactions', 'providers', { area: PANEL, target: `${PANEL} ${text('Visa Cal (SMS code)')}`, pad: 0 });
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
    await tab('Transactions');
    await shot('transactions', 'list', { target: 'button[title="Edit transaction"]' });
    await tab('Budget');
    await pause(1500);
    await shot('update-budget', 'overview');
    await click(text('Categories'));
    await pause(1000);
    await shot('update-budget', 'categories', { target: `${text('Edit')}` });
    await click(text('Edit'));
    await markPanel(text('Details'));
    await shot('update-budget', 'details', { area: PANEL, target: `${PANEL} ${text('Monthly limit')}`, pad: 0 });
    await click(`${PANEL} button::-p-text(Adjust)`);
    await shot('update-budget', 'adjust', { area: PANEL, target: `${PANEL} ${text('New limit')}`, pad: 0 });
    await click(`${PANEL} button::-p-text(Merge)`);
    await shot('update-budget', 'merge', { area: PANEL, target: `${PANEL} select`, pad: 0 });
    await page.keyboard.press('Escape');
    await go('/');
    await tab('Budget');
    await click(text('Settings'));
    await waitText('Budget history');
    await page.evaluate(() => [...document.querySelectorAll('h2,h3')].find((h) => h.textContent?.includes('Budget history'))?.scrollIntoView({ block: 'start' }));
    await pause(500);
    await shot('update-budget', 'history');

    await tab('Insights');
    await pause(3000);
    await shot('insights', 'range', { target: text('Current month') });
    for (const [title, name] of [
      ['Budget summary', 'summary'],
      ['Original vs current', 'chart'],
      ['Category accuracy', 'accuracy'],
      ['Category pace tracker', 'pace'],
      ['Household member expenses', 'members'],
    ]) {
      await page.evaluate((t) => [...document.querySelectorAll('h2,h3')].find((h) => h.textContent?.includes(t))?.scrollIntoView({ block: 'start' }), title);
      await page.evaluate(() => window.scrollBy(0, -80));
      await pause(900);
      await shot('insights', name);
    }
  },
};

const phase = process.argv[2];
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
