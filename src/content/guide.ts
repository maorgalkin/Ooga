import type { LucideIcon } from 'lucide-react';
import { Home, PiggyBank, ReceiptText, SlidersHorizontal, TrendingUp } from 'lucide-react';
import type { ClipFrame } from '../components/info/GuideClip';
import FRAMES from './guide-frames.json';

export interface GuideStep {
  title: string;
  body: string[];
  tip?: string;
  clip?: { alt: string; frames: ClipFrame[] };
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

// Screenshots come from a made-up demo household, never a real account, and are
// regenerated with scripts/demo/capture-guide.mjs, which also records where the pointer
// and highlight go on each frame in guide-frames.json.
const frames = FRAMES as Record<string, ClipFrame>;
const clip = (alt: string, ...keys: string[]) => ({ alt, frames: keys.map((k) => frames[k]) });

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
          "Open Ooga and choose Create account. Enter your first and last name, your email and a password of at least 6 characters.",
          "We send you a verification link. Open it, then sign in.",
        ],
      },
      {
        title: "Meet your household",
        clip: clip("The empty Dashboard with the Manage household link, then the Household settings window", 'household/dashboard-empty', 'household/settings'),
        body: [
          "Ooga creates a household for you automatically, named after you (for example \"Dana's Household\"), and makes you its owner.",
          "To open it, go to the Dashboard tab and click \"Manage household\" under the month title.",
        ],
      },
      {
        title: "Give it a name",
        clip: clip("Renaming the household in Household settings", 'household/settings', 'household/rename'),
        body: [
          "In Household settings, click Edit next to the name, type a new one and press Enter.",
        ],
        tip: "Only the owner can rename the household or invite people.",
      },
      {
        title: "Add the rest of the family",
        clip: clip("Household settings listing Dana, Avi and the kids Noa and Itai, with the Add member button", 'household/members'),
        body: [
          "Click Add member to add someone who won't sign in, such as your kids. They become family members you can pick on transactions, so you can later see who spent what.",
          "Everyone who joins with their own login gets a family member automatically.",
        ],
      },
      {
        title: "Invite your partner",
        clip: clip("The invitation code with its Copy button, and the Switch households button your partner uses", 'household/invite', 'household/switch'),
        featured: true,
        body: [
          "Under \"Invite budget participants\", click Copy to copy your invitation code and send it to your partner.",
          "Your partner creates their own account, opens Household settings, clicks Switch households and pastes the code. They'll see a warning that their data will be deleted: that's the empty household Ooga made for them when they created their account, so it's safe to continue with \"Delete data & join\".",
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
    minutes: 4,
    icon: PiggyBank,
    tint: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    landing: true,
    steps: [
      {
        title: "Open the Budget tab",
        clip: clip("The Budget tab before a budget exists, with the Create budget button", 'budget/tab'),
        body: [
          "Click the Budget tab, or \"Set up budget\" on an empty Dashboard. With no budget yet, the Overview shows the budget editor.",
        ],
      },
      {
        title: "Start from the defaults",
        clip: clip("The budget editor with a name and the five default categories", 'budget/defaults'),
        body: [
          "Click Create budget. Ooga fills in five common categories (Groceries, Transportation, Entertainment, Bills & Utilities, Home & Garden) with starter limits.",
          "Give the budget a name you'll recognize, such as \"Family budget 2026\".",
        ],
      },
      {
        title: "Make the categories yours",
        clip: clip("Changing the Groceries limit, then adding a Kids category", 'budget/edit-category', 'budget/add-category'),
        featured: true,
        body: [
          "Click a category tile to change its monthly limit, its warning threshold (80% by default) or its color.",
          "Use the Add category tile for anything that's missing, like Kids or Dining out.",
        ],
        tip: "Not sure what to set? Start with what you spent last month. You can fine-tune limits any time.",
      },
      {
        title: "Save the budget",
        clip: clip("Saving the budget, then the Overview summary that replaces the editor", 'budget/save', 'budget/saved'),
        body: [
          "Check the total monthly budget at the bottom, then click Save budget. The Overview switches to a summary of the month: what's budgeted, what's spent and what's left.",
        ],
        tip: "Amounts are in shekels by default. To change the currency, go to Budget, then Settings.",
      },
    ],
  },
  {
    slug: 'transactions',
    title: 'Add transactions',
    summary: 'Enter spending by hand or import it from your bank.',
    intro: "Every expense and income goes into Ooga as a transaction. Enter them by hand as they happen, import them from your bank, or both: set \"Paid with\" on the ones you enter by hand, and the import matches the bank's charge to them so nothing is counted twice.",
    minutes: 4,
    icon: ReceiptText,
    tint: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    landing: true,
    steps: [
      {
        title: "Add an expense",
        clip: clip("The Add transaction window: choosing Groceries and filling in the amount", 'transactions/modal', 'transactions/categories', 'transactions/filled'),
        featured: true,
        body: [
          "Click Add transaction in the top bar. Pick a category with Choose, enter the amount and the date, and optionally a description and the family member it was for.",
          "Click Submit and it appears on the Dashboard straight away.",
        ],
      },
      {
        title: "Record income",
        clip: clip("The Add transaction window switched to Income", 'transactions/income'),
        body: [
          "Switch the toggle at the top to Income and choose a source, such as Salary. Ooga fills in a description for you.",
        ],
      },
      {
        title: "Split a purchase into installments",
        clip: clip("The Add expense window for a 412 grocery purchase, with \"Create as installments\" ticked and 6 entered as the number of months", 'transactions/installments'),
        body: [
          "For a purchase paid over several months, tick \"Create as installments\" and enter the number of months. Ooga adds one installment per month, so future months show what's already committed.",
        ],
      },
      {
        title: "Connect a bank or card",
        clip: clip("Connected accounts in Budget settings, then the list of banks and cards to connect", 'transactions/accounts', 'transactions/providers'),
        body: [
          "Go to Budget, then Settings, then Connected accounts, and click Add account. The list shows several banks and cards, but Ooga can import only from Visa Cal (SMS code) and Discount Bank for now; the others aren't supported yet.",
          "Enter the details the bank asks for and click Test & save. Everyone in the household can import from the account; only you can remove it.",
        ],
        tip: "For Visa Cal (SMS code), Ooga saves only your ID number and the card's last 4 digits, and you confirm each import with an SMS code. For Discount Bank, your login details are stored encrypted and used only to import your transactions.",
      },
      {
        title: "Import from the bank",
        body: [
          "Open Add transaction and click the account's tile under Import transactions. Choose the import period (Current month, Last month or Custom). For Discount Bank, click Import. For Visa Cal, click Send code, enter the verification code Visa Cal texts you and click Verify & import.",
          "Review the list: pick categories, untick anything you don't want and accept. Duplicates are skipped. A bank row that matches a transaction you entered by hand with \"Paid with\" set to this account is merged into it.",
        ],
        tip: "Entered a purchase by hand before the bank charged it? Set \"Paid with\" to the card, and the import will match the charge to your entry.",
      },
      {
        title: "Fix a transaction",
        clip: clip("The Transactions tab with the month carousel, filters and an edit pencil on each transaction", 'transactions/list'),
        body: [
          "On the Transactions tab, find the transaction (filter by category or family member if you need to) and click the pencil to edit or delete it.",
        ],
      },
    ],
  },
  {
    slug: 'update-budget',
    title: 'Keep your budget current',
    summary: 'Change limits, adjust a single month and manage categories as life changes.',
    intro: "Real months rarely match the plan. Ooga lets you fix a single month, change the plan from next month on, and go back to an earlier version if you need to.",
    minutes: 3,
    icon: SlidersHorizontal,
    tint: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    steps: [
      {
        title: "Check where you stand",
        clip: clip("The budget Overview: monthly budget, spent so far and what remains", 'update-budget/overview'),
        body: [
          "The Budget tab's Overview shows the monthly budget, what's spent so far and what remains, with a bar for overall usage. Pick a category to see its biggest expense and how often it stayed within its limit over the last 3 months.",
        ],
      },
      {
        title: "Adjust this month only",
        clip: clip("The Categories tab, then the Details tab of Edit category with the monthly limit", 'update-budget/categories', 'update-budget/details'),
        body: [
          "On the Categories tab, click Edit next to a category. On the Details tab, change the monthly limit and save.",
          "This is a quick fix for the current month: next month starts from the planned limit again.",
        ],
      },
      {
        title: "Change the plan from next month",
        clip: clip("The Adjust tab, showing the current limit and the new planned limit", 'update-budget/adjust'),
        body: [
          "In the same window, use the Adjust tab to set a new limit, with a reason if you like. The change is scheduled for next month and shows in the Next month summary.",
          "The first time anyone opens Ooga in the new month, Ooga applies scheduled changes and saves a new version of the budget.",
        ],
      },
      {
        title: "Tidy up categories",
        clip: clip("The Merge tab, choosing which category to merge into", 'update-budget/merge'),
        body: [
          "Rename a category on the Details tab and the new name shows everywhere, including past transactions.",
          "Two categories doing the same job? Use Merge to move one's transactions into the other.",
        ],
      },
      {
        title: "Go back to an earlier version",
        clip: clip("Budget history in Budget settings, listing the saved version \"Family budget\" marked Active, with its 7 categories and monthly total", 'update-budget/history'),
        body: [
          "Every saved change keeps a version. Under Budget, then Settings, Budget history lists them; click the star to make one active again.",
        ],
      },
    ],
  },
  {
    slug: 'insights',
    title: 'Understand your trends',
    summary: 'Insights compares your budget with actual spending and shows where it drifts.',
    intro: "Once a few weeks of transactions are in, Ooga starts showing patterns: where the money goes, which categories drift and who spends what.",
    minutes: 3,
    icon: TrendingUp,
    tint: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    landing: true,
    steps: [
      {
        title: "Read the Dashboard",
        clip: clip("The Dashboard: category cards, the month's totals and the expenses chart", 'insights/dashboard', 'insights/dashboard-chart'),
        body: [
          "The Dashboard shows the month at a glance: income, expenses, balance and how much of the budget is used. Category cards fill up as you spend, and any category that goes over its monthly limit is flagged as over budget.",
          "Use the arrows next to the month to look back, or ahead to see installments that are already committed.",
        ],
      },
      {
        title: "Open Insights and pick a range",
        clip: clip("The Insights tab with its date range buttons", 'insights/range'),
        body: [
          "Click the Insights tab. Start with the current month; longer ranges such as Year to date and Last 12 months appear as your history grows.",
        ],
      },
      {
        title: "Compare plan and reality",
        clip: clip("Budget summary and the chart comparing budget with actual spending by category", 'insights/summary', 'insights/chart'),
        featured: true,
        body: [
          "Budget summary compares what you planned at the start of the month with what you spent. The category chart shows the original budget, the current budget and actual spending side by side, colored by how close each category came.",
        ],
      },
      {
        title: "See how accurate your budget is",
        clip: clip("Category accuracy, scoring a category against its target", 'insights/accuracy'),
        body: [
          "Category accuracy scores each category against its target. Close to 100% means your limit is realistic; far above or below means it's time to adjust it.",
        ],
        tip: "Consistently under budget in a category? Move some of that limit to one that always runs over.",
      },
      {
        title: "Catch overspending early",
        clip: clip("Category pace tracker, with checkpoints through the month", 'insights/pace'),
        body: [
          "Category pace tracker checks a category at points in the month (end of week 1, mid-month, end of week 4) against your usual pace, so you can slow down before the month ends.",
        ],
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
