import type { LucideIcon } from 'lucide-react';
import { Home, PiggyBank, ReceiptText, SlidersHorizontal, TrendingUp } from 'lucide-react';
import type { ClipFrame } from '../components/info/GuideClip';
import FRAMES from './guide-frames.json';
import MOBILE_FRAMES from './guide-frames.mobile.json';

export interface GuideStep {
  title: string;
  body: string[];
  tip?: string;
  clip?: { alt: string; frames: ClipFrame[]; mobileFrames?: ClipFrame[] };
  /** Where in the app to do this step; shown at the end of the step's text. */
  link?: { label: string; to: string };
  /** The step "How it works" on the sign-in page shows for this chapter. */
  featured?: boolean;
}

export interface GuideChapter {
  slug: string;
  title: string;
  summary: string;
  intro: string;
  minutes: number;
  icon: LucideIcon;
  tint: string;
  /** Also shown in "How it works" on the sign-in page, with its featured step. */
  landing?: boolean;
  steps: GuideStep[];
}

export interface GuidePart {
  title: string;
  /** How often the reader comes back to this part, e.g. "Once". */
  cadence: string;
  purpose: string;
  /** Chapter slugs, in reading order. */
  chapters: string[];
}

// Screenshots come from a made-up demo household, never a real account, and are
// regenerated with scripts/demo/capture-guide.mjs, which also records where the pointer
// and highlight go on each frame in guide-frames.json (guide-frames.mobile.json for phones).
const frames = FRAMES as Record<string, ClipFrame>;
const mobileFrames = MOBILE_FRAMES as Record<string, ClipFrame>;
const clip = (alt: string, ...keys: string[]) => {
  // A phone set is used only when every frame has a phone version, so a clip never mixes the two
  const mobile = keys.map((k) => mobileFrames[k]);
  return { alt, frames: keys.map((k) => frames[k]), mobileFrames: mobile.every(Boolean) ? mobile : undefined };
};

const BUDGET_SETTINGS = { label: 'Open Budget settings', to: '/?tab=budget&subtab=settings' };

/** The Getting started guide, chapter by chapter. Edit text here; the page only lays it out. */
export const GUIDE_CHAPTERS: GuideChapter[] = [
  {
    slug: 'household',
    title: 'Set up your household',
    summary: 'Create your account, name your household and invite your partner.',
    intro: "Ooga keeps everything for your family in one household: the budget, the transactions and the connected accounts. Yours is created for you the moment you create your account.",
    minutes: 3,
    icon: Home,
    tint: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    landing: true,
    steps: [
      {
        title: "Create your account",
        clip: clip("The Create account form being filled in with a name, email and password", 'household/register-1', 'household/register-2', 'household/register-3'),
        body: [
          "Click Create account and enter your name, your email and a password of at least 6 characters. Open the verification link we email you, then sign in.",
          "Ooga creates your household straight away, named after you (for example \"Dana's Household\"), and makes you its owner.",
        ],
        link: { label: 'Create account', to: '/register' },
      },
      {
        title: "Name it and add the family",
        clip: clip("Household settings: renaming the household, then the member list with Dana, Avi and the kids Noa and Itai", 'household/dashboard-empty', 'household/rename', 'household/members'),
        body: [
          "On the Dashboard, click \"Manage household\" under the month title. Click Edit next to the name to rename it.",
          "Click Add member for anyone who won't sign in, such as your kids. You can pick them on transactions later to see who spent what. Everyone who joins with their own login is added automatically.",
        ],
        tip: "Only the owner can rename the household, add family members or invite people.",
        link: { label: 'Open Dashboard', to: '/' },
      },
      {
        title: "Invite your partner",
        clip: clip("The invitation code with its Copy button, and the Switch households button your partner uses", 'household/invite', 'household/switch'),
        featured: true,
        body: [
          "In Household settings, under \"Invite budget participants\", click Copy and send the code to your partner.",
          "Your partner creates their own account, opens Household settings, clicks Switch households and pastes the code. The warning that their data will be deleted refers to the empty household Ooga made for them, so it's safe to continue with \"Delete data & join\".",
        ],
        tip: "Anyone with the code can join, so share it only with people you trust.",
      },
    ],
  },
  {
    slug: 'budget',
    title: 'Create your budget',
    summary: 'Pick your categories and give each one a monthly limit.',
    intro: "A budget in Ooga is a list of categories, each with a monthly limit. Ooga tracks every month against it and warns you before a category runs over.",
    minutes: 3,
    icon: PiggyBank,
    tint: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    landing: true,
    steps: [
      {
        title: "Start your budget",
        clip: clip("The Budget tab with the Create budget button, then the editor with five default categories", 'budget/tab', 'budget/defaults'),
        body: [
          "On the Budget tab, click Create budget. Ooga starts you off with five common categories (Groceries, Transportation, Entertainment, Bills & Utilities, Home & Garden) and starter limits.",
          "Give the budget a name you'll recognize, such as \"Family budget 2026\".",
        ],
        link: { label: 'Create budget', to: '/?tab=budget&create=true' },
      },
      {
        title: "Make it yours and save",
        clip: clip("Changing the Groceries limit, adding a Kids category, then saving the budget", 'budget/edit-category', 'budget/add-category', 'budget/save', 'budget/saved'),
        featured: true,
        body: [
          "Click a category to change its monthly limit, its warning threshold (80% by default) or its color. Use the Add category tile for anything missing, like Kids or Dining out.",
          "Check the monthly total at the bottom and click Save budget. The Overview then shows the month: what's budgeted, what's spent and what's left.",
        ],
        tip: "Not sure what to set? Start with what you spent last month; you can fine-tune limits any time. Amounts are in shekels unless you change the currency in Budget settings.",
      },
    ],
  },
  {
    slug: 'transactions',
    title: 'Add transactions',
    summary: 'Enter spending by hand or import it from your bank, then see the month on the Dashboard.',
    intro: "Every expense and income goes into Ooga as a transaction. Enter them by hand as they happen, import them from your bank, or both: set \"Paid with\" on the ones you enter by hand, and the import matches the bank's charge to them so nothing is counted twice.",
    minutes: 4,
    icon: ReceiptText,
    tint: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    landing: true,
    steps: [
      {
        title: "Add an expense or income",
        clip: clip("The Add transaction window: choosing Groceries and filling in the amount, then the same window switched to Income", 'transactions/modal', 'transactions/categories', 'transactions/filled', 'transactions/income'),
        featured: true,
        body: [
          "Click Add transaction in the top bar. Pick a category with Choose, enter the amount and date, and optionally a description and the family member it was for. Click Submit.",
          "For money coming in, choose Income at the top and choose a source, such as Salary.",
        ],
      },
      {
        title: "Split a purchase into installments",
        clip: clip("The Add expense window for a 412 grocery purchase, with \"Create as installments\" ticked and 6 entered as the number of months", 'transactions/installments'),
        body: [
          "Paying over several months? Tick \"Create as installments\" and enter the number of months. Ooga adds one installment per month, so future months show what's already committed.",
        ],
      },
      {
        title: "Connect a bank or card",
        clip: clip("Connected accounts in Budget settings, then the list of banks and cards to connect", 'transactions/accounts', 'transactions/providers'),
        body: [
          "In Budget settings, under Connected accounts, click Add account. Ooga can import from Visa Cal (SMS code) and Discount Bank for now; the others in the list are marked Coming soon.",
          "Enter the details the bank asks for and click Test & save. Everyone in the household can import from the account; only you can remove it.",
        ],
        tip: "For Visa Cal (SMS code), Ooga saves only your National ID and the card's last 4 digits, and you confirm each import with an SMS code. For Discount Bank, your login details are stored encrypted and used only to import your transactions.",
        link: BUDGET_SETTINGS,
      },
      {
        title: "Import from the bank",
        body: [
          "Open Add transaction and click the account's tile under Import transactions. Choose the period (Current month, Last month or Custom). For Discount Bank, click Import. For Visa Cal, click Send code, enter the code Visa Cal texts you and click Verify & import.",
          "Review the list: pick categories, untick anything you don't want and click Accept. Duplicates are skipped, and a bank row that matches a transaction you entered with \"Paid with\" set to this account is merged into it.",
        ],
      },
      {
        title: "Fix a transaction",
        clip: clip("The Transactions tab with the month carousel, filters and an edit pencil on each transaction", 'transactions/list'),
        body: [
          "On the Transactions tab, find the transaction (filter by category or family member if you need to) and click the pencil to edit or delete it.",
        ],
        link: { label: 'Open Transactions', to: '/?tab=transactions' },
      },
      {
        title: "Glance at the Dashboard",
        clip: clip("The Dashboard: category cards, the month's totals and the expenses chart", 'insights/dashboard', 'insights/dashboard-chart'),
        body: [
          "The Dashboard shows the month at a glance: income, expenses, balance and how much of the budget is used. Category cards fill up as you spend, and a category that goes over its limit is flagged as over budget.",
          "Use the arrows next to the month to look back, or ahead to installments that are already committed.",
        ],
        link: { label: 'Open Dashboard', to: '/' },
      },
    ],
  },
  {
    slug: 'update-budget',
    title: 'Keep your budget current',
    summary: 'Change a limit for one month or for good, tidy up categories and go back to an earlier version.',
    intro: "Real months rarely match the plan. Ooga lets you fix a single month, change the plan from next month on, and go back to an earlier version if you need to.",
    minutes: 3,
    icon: SlidersHorizontal,
    tint: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    steps: [
      {
        title: "Check where you stand",
        clip: clip("The budget Overview: monthly budget, spent so far and what remains", 'update-budget/overview'),
        body: [
          "The Budget tab's Overview shows the monthly budget, what's spent so far and what remains. Pick a category to see its biggest expense and how often it stayed within its limit over the last 3 months.",
        ],
        link: { label: 'Open Budget', to: '/?tab=budget' },
      },
      {
        title: "Change a limit",
        clip: clip("Edit category: the Details tab with this month's limit, then the Adjust tab with the new planned limit", 'update-budget/categories', 'update-budget/details', 'update-budget/adjust'),
        body: [
          "On the Categories tab, click Edit next to a category. Then choose how long the change should last:",
          "This month only: change the monthly limit on the Details tab. Next month starts from the planned limit again.",
          "From next month on: set a new limit on the Adjust tab. The first time anyone opens Ooga in the new month, Ooga applies it and saves a new version of the budget.",
        ],
        link: { label: 'Open Categories', to: '/?tab=budget&subtab=categories' },
      },
      {
        title: "Tidy up categories",
        clip: clip("The Merge tab, choosing which category to merge into", 'update-budget/merge'),
        body: [
          "Rename a category on the Details tab and the new name shows everywhere, including past transactions. Two categories doing the same job? Use the Merge tab to move one's transactions into the other.",
        ],
      },
      {
        title: "Go back to an earlier version",
        clip: clip("Budget history in Budget settings, listing the saved version \"Family budget\" marked Active, with its 7 categories and monthly total", 'update-budget/history'),
        body: [
          "Every saved change keeps a version. Budget history, in Budget settings, lists them; click the star to make one active again.",
        ],
        link: BUDGET_SETTINGS,
      },
    ],
  },
  {
    slug: 'insights',
    title: 'Understand your trends',
    summary: 'Insights compares your budget with actual spending and shows where it drifts.',
    intro: "Once a few weeks of transactions are in, Ooga starts showing patterns: where the money goes, which categories drift and who spends what.",
    minutes: 2,
    icon: TrendingUp,
    tint: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    landing: true,
    steps: [
      {
        title: "Compare plan and reality",
        clip: clip("The Insights date range, the Budget summary and the chart comparing budget with actual spending by category", 'insights/range', 'insights/summary', 'insights/chart'),
        featured: true,
        body: [
          "On the Insights tab, start with the current month; longer ranges such as Year to date appear as your history grows.",
          "Budget summary compares what you planned at the start of the month with what you spent. The category chart shows the original budget, the current budget and actual spending side by side, colored by how close each category came.",
        ],
        link: { label: 'Open Insights', to: '/?tab=insights' },
      },
      {
        title: "Spot categories that drift",
        clip: clip("Category accuracy scoring a category against its target, then the Category pace tracker with checkpoints through the month", 'insights/accuracy', 'insights/pace'),
        body: [
          "Category accuracy scores each category against its monthly limit: close to 100% means the limit is realistic, far off means it's time to adjust it.",
          "Category pace tracker checks a category at points in the month (end of week 1, mid-month, end of week 4) against your usual pace, so you can slow down before the month ends.",
        ],
        tip: "Consistently under budget in a category? Move some of that limit to one that always runs over.",
      },
      {
        title: "See who spends what",
        clip: clip("Household member expenses, with a card per family member", 'insights/members'),
        body: [
          "Household member expenses breaks spending down by family member: their total, their share of the household's spending and their top categories.",
        ],
      },
    ],
  },
];

/** The guide's four parts, which group the chapters by how often you need them. */
export const GUIDE_PARTS: GuidePart[] = [
  {
    title: 'Getting started',
    cadence: 'Once',
    purpose: 'Create your account and bring the family in.',
    chapters: ['household'],
  },
  {
    title: 'Setting up the budget',
    cadence: 'Once',
    purpose: 'Decide what you plan to spend each month.',
    chapters: ['budget'],
  },
  {
    title: 'The day-to-day',
    cadence: 'A minute or two at a time',
    purpose: 'Add what you spend and adjust the plan as life happens.',
    chapters: ['transactions', 'update-budget'],
  },
  {
    title: 'Deeper understanding',
    cadence: 'After a few weeks, whenever you like',
    purpose: 'See where the money really goes and how your plan holds up.',
    chapters: ['insights'],
  },
];

/** The part a chapter belongs to, with its 1-based number. */
export function partOf(slug: string) {
  const index = GUIDE_PARTS.findIndex((p) => p.chapters.includes(slug));
  return index === -1 ? undefined : { part: GUIDE_PARTS[index], number: index + 1 };
}
