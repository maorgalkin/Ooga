/**
 * Demo household for the Getting started guide's screenshots. Runs only against the test
 * Supabase project from .env.test.local and refuses to run against the app's own project.
 *
 *   npx tsx scripts/demo/seed-demo-household.ts user      # create the demo sign-in (once)
 *   npx tsx scripts/demo/seed-demo-household.ts family    # add a partner and two kids
 *   npx tsx scripts/demo/seed-demo-household.ts fresh     # empty the household again (keeps the people)
 *   npx tsx scripts/demo/seed-demo-household.ts history   # add ~3 months of past spending
 *   npx tsx scripts/demo/seed-demo-household.ts reset     # delete the demo user and their data
 *
 * The demo sign-in is written to .env.demo.local (gitignored), never printed.
 * `history` signs in as the demo user, so every row goes through the same RLS as the app;
 * run it after the budget has been created in the UI so the categories exist.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { testProject } from './guard.mjs';

const read = (file: string) => (existsSync(file) ? parse(readFileSync(file)) : {});
const DEMO_FILE = '.env.demo.local';
const DEMO_EMAIL = 'demo-family@ooga-test.local';
const PARTNER_EMAIL = 'demo-partner@ooga-test.local';

const { url, anonKey, serviceKey } = testProject({ needServiceKey: true });

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(url, serviceKey, noSession);

async function findUserId(email: string): Promise<string | null> {
  // The integration suites leave plenty of users behind, so walk every page
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 1000) return null;
  }
}
const findDemoUserId = () => findUserId(DEMO_EMAIL);

async function createUser() {
  if (await findDemoUserId()) {
    console.log(`Demo user already exists. Its sign-in is in ${DEMO_FILE}.`);
    return;
  }
  const password = randomBytes(12).toString('base64url');
  const { error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { first_name: 'Dana', last_name: 'Levi', full_name: 'Dana Levi' },
  });
  if (error) throw error;
  writeFileSync(DEMO_FILE, `DEMO_EMAIL=${DEMO_EMAIL}\nDEMO_PASSWORD=${password}\n`, { mode: 0o600 });
  console.log(`Demo user created. Its sign-in is in ${DEMO_FILE}.`);
}

// A partner with their own login (joined the way an invitation code would) and two kids
// who are family members without one, so Household settings and Insights look lived-in.
async function addFamily() {
  const ownerId = await findDemoUserId();
  if (!ownerId) throw new Error('Run the "user" step first.');
  const { data: owner } = await admin.from('household_members').select('household_id').eq('user_id', ownerId).single();
  if (!owner) throw new Error('The demo user has no household yet.');

  // The guide's capture renames the household, so start each run from the sign-up name
  await admin.from('households').update({ name: "Dana's Household" }).eq('id', owner.household_id);

  let partnerId = await findUserId(PARTNER_EMAIL);
  if (!partnerId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: PARTNER_EMAIL,
      password: randomBytes(18).toString('base64url'), // nobody signs in as the partner
      email_confirm: true,
      user_metadata: { first_name: 'Avi', last_name: 'Levi', full_name: 'Avi Levi' },
    });
    if (error) throw error;
    partnerId = data.user.id;
  }
  const { data: own } = await admin.from('household_members').select('household_id').eq('user_id', partnerId).maybeSingle();
  if (own && own.household_id !== owner.household_id) {
    // Normally the household the sign-up trigger made for the partner; never delete a shared one
    const { count } = await admin
      .from('household_members')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', own.household_id);
    if (count !== 1) throw new Error("The partner is in someone else's household. Refusing to move them.");
    await admin.from('household_members').delete().eq('user_id', partnerId);
    await admin.from('households').delete().eq('id', own.household_id);
  }
  if (!own || own.household_id !== owner.household_id) {
    const { error } = await admin
      .from('household_members')
      .insert({ household_id: owner.household_id, user_id: partnerId, role: 'participant', invited_by: ownerId });
    if (error) throw error;
  }

  const { data: existing } = await admin.from('family_members').select('name').eq('household_id', owner.household_id);
  const names = new Set((existing ?? []).map((m) => m.name));
  const kids = [
    { name: 'Noa', color: '#EC4899' },
    { name: 'Itai', color: '#F59E0B' },
  ].filter((k) => !names.has(k.name));
  if (kids.length) {
    const { error } = await admin
      .from('family_members')
      .insert(kids.map((k) => ({ ...k, household_id: owner.household_id, user_id: ownerId })));
    if (error) throw error;
  }
  console.log('Partner and kids are in the demo household.');
}

// Takes the demo household back to "just signed up" so the capture can run again from the top.
async function makeFresh() {
  const ownerId = await findDemoUserId();
  if (!ownerId) throw new Error('Run the "user" step first.');
  const { data: owner } = await admin.from('household_members').select('household_id').eq('user_id', ownerId).single();
  if (!owner) throw new Error('The demo user has no household yet.');
  const tables = [
    'transactions',
    'budget_adjustments',
    'category_adjustment_history',
    'category_merge_history',
    'monthly_budgets',
    'personal_budgets',
    'categories',
  ];
  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq('household_id', owner.household_id);
    if (error && !['42P01', '42703', 'PGRST205'].includes(error.code)) throw new Error(`${table}: ${error.message}`);
  }
  await admin.from('households').update({ name: "Dana's Household" }).eq('id', owner.household_id);
  console.log('Demo household emptied.');
}

// Typical monthly spend per category name; anything unlisted gets a modest default.
const MONTHLY: Record<string, { total: number; merchants: string[] }> = {
  Groceries: { total: 3200, merchants: ['Shufersal', 'Rami Levy', 'Victory', 'Yochananof', 'Local market'] },
  Food: { total: 3200, merchants: ['Shufersal', 'Rami Levy', 'Victory', 'Local market'] },
  'Dining out': { total: 900, merchants: ['Aroma', 'Cafe Cafe', 'Pizza night', 'Sushi with friends'] },
  Restaurants: { total: 900, merchants: ['Aroma', 'Cafe Cafe', 'Pizza night'] },
  Transportation: { total: 1100, merchants: ['Paz fuel', 'Rav-Kav top-up', 'Parking', 'Delek fuel'] },
  Transport: { total: 1100, merchants: ['Paz fuel', 'Rav-Kav top-up', 'Parking'] },
  Utilities: { total: 750, merchants: ['Electric company', 'Water bill', 'Internet', 'Mobile plan'] },
  'Bills & Utilities': { total: 1050, merchants: ['Electric company', 'Water bill', 'Internet', 'Mobile plan', 'Arnona'] },
  'Home & Garden': { total: 350, merchants: ['ACE hardware', 'IKEA', 'Plant nursery'] },
  Bills: { total: 750, merchants: ['Electric company', 'Water bill', 'Internet'] },
  Entertainment: { total: 500, merchants: ['Cinema City', 'Netflix', 'Spotify', 'Escape room'] },
  Shopping: { total: 800, merchants: ['Super-Pharm', 'Fox', 'IKEA', 'Amazon'] },
  Health: { total: 400, merchants: ['Super-Pharm', 'Dentist', 'Pharmacy'] },
  Healthcare: { total: 400, merchants: ['Super-Pharm', 'Dentist', 'Pharmacy'] },
  Kids: { total: 1200, merchants: ['After-school club', 'Swimming lessons', 'School supplies', 'Birthday gift'] },
  Education: { total: 1200, merchants: ['After-school club', 'Books', 'School trip'] },
  Home: { total: 600, merchants: ['ACE hardware', 'IKEA', 'Cleaning supplies'] },
};

// How each category usually lands against its limit (1 = right on it).
const HABIT: Record<string, number> = {
  Groceries: 0.93,
  'Dining out': 1.12,
  Kids: 0.98,
  Transportation: 0.8,
  Entertainment: 1.04,
  'Bills & Utilities': 0.9,
  'Home & Garden': 0.6,
};

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

async function addHistory() {
  const env = read(DEMO_FILE);
  if (!env.DEMO_PASSWORD) throw new Error(`Run the "user" step first; ${DEMO_FILE} is missing.`);
  const user = createClient(url, anonKey, noSession);
  const { data: auth, error: signInError } = await user.auth.signInWithPassword({
    email: env.DEMO_EMAIL,
    password: env.DEMO_PASSWORD,
  });
  if (signInError) throw signInError;
  const userId = auth.user.id;

  const { data: membership } = await user.from('household_members').select('household_id').eq('user_id', userId).single();
  if (!membership) throw new Error('The demo user has no household yet. Sign in once in the app first.');
  const householdId = membership.household_id;

  const { data: categories } = await user
    .from('categories')
    .select('id, name, monthly_limit')
    .eq('household_id', householdId)
    .is('deleted_at', null);
  if (!categories?.length) throw new Error('No categories yet. Create the budget in the app first.');
  const { data: members } = await user.from('family_members').select('id, name').eq('household_id', householdId);
  const memberId = (name: string) => members?.find((m) => m.name === name)?.id ?? null;

  // Start from a clean slate so running this twice doesn't double the spending
  const { error: clearError } = await user.from('transactions').delete().eq('household_id', householdId);
  if (clearError) throw clearError;

  const random = rng(42);
  const today = new Date();
  const rows: Record<string, unknown>[] = [];
  const row = (date: Date, fields: Record<string, unknown>) =>
    rows.push({ user_id: userId, household_id: householdId, date: date.toLocaleDateString('en-CA'), ...fields });

  // Three full past months plus the current month up to yesterday. Spending follows each
  // category's limit with a steady habit per category (dining out runs hot, home runs cool)
  // and some month-to-month drift, so Insights has both hits and misses to show.
  for (let back = 3; back >= 0; back--) {
    const first = new Date(today.getFullYear(), today.getMonth() - back, 1);
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const lastDay = back === 0 ? Math.max(1, today.getDate() - 1) : daysInMonth;
    const monthDrift = 0.92 + random() * 0.14;

    for (const [name, amount, day] of [['Dana', 14200, 10], ['Avi', 11800, 10]] as const) {
      if (day > lastDay) continue;
      const month = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      row(new Date(first.getFullYear(), first.getMonth(), day), {
        description: `Salary - ${month}`,
        amount,
        category: 'Salary',
        type: 'income',
        family_member_id: memberId(name),
      });
    }

    for (const category of categories) {
      const profile = MONTHLY[category.name] ?? { total: 350, merchants: [category.name] };
      const limit = Number(category.monthly_limit) || profile.total;
      const target = limit * (HABIT[category.name] ?? 0.85) * monthDrift * (lastDay / daysInMonth);
      const count = Math.max(2, Math.round(limit / 250));
      for (let i = 0; i < count; i++) {
        row(new Date(first.getFullYear(), first.getMonth(), 1 + Math.floor(random() * lastDay)), {
          description: profile.merchants[Math.floor(random() * profile.merchants.length)],
          amount: Math.max(12, Math.round((target / count) * (0.6 + random() * 0.8))),
          category: category.name,
          category_id: category.id,
          type: 'expense',
          family_member_id: members?.length ? members[Math.floor(random() * members.length)].id : null,
        });
      }
    }
  }

  const { error } = await user.from('transactions').insert(rows);
  if (error) throw error;
  console.log(`Added ${rows.length} transactions.`);
}

async function reset() {
  const id = await findDemoUserId();
  if (!id) {
    console.log('No demo user to remove.');
    return;
  }
  const { data: membership } = await admin.from('household_members').select('household_id').eq('user_id', id).maybeSingle();
  if (membership) {
    const { error } = await admin.from('transactions').delete().eq('household_id', membership.household_id);
    if (error) throw error;
  }
  for (const userId of [id, await findUserId(PARTNER_EMAIL)]) {
    if (!userId) continue;
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
  // Deleting the users removes their memberships; the household row itself is left behind
  if (membership) await admin.from('households').delete().eq('id', membership.household_id);
  console.log('Demo users removed.');
}

const step = process.argv[2];
const steps: Record<string, () => Promise<void>> = { user: createUser, family: addFamily, fresh: makeFresh, history: addHistory, reset };
if (!steps[step]) {
  console.error('Usage: npx tsx scripts/demo/seed-demo-household.ts <user|family|fresh|history|reset>');
  process.exit(1);
}
await steps[step]();
