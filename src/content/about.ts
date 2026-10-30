import { Users, PiggyBank, Landmark, TrendingUp } from 'lucide-react';

/** What Ooga does, in four cards; shared by the About page and the sign-in landing page. */
export const FEATURES = [
  {
    icon: Users,
    title: 'One household, everyone in it',
    body: 'Invite your partner with an invitation code and share one budget. Mark each transaction with the family member it was for, kids included.',
    tint: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
  {
    icon: PiggyBank,
    title: 'A budget that fits your month',
    body: 'Give each category a monthly limit. Adjust a month when life happens, and keep a history of every version.',
    tint: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  {
    icon: Landmark,
    title: 'Your bank, without the typing',
    body: 'Import transactions from Visa Cal and Discount Bank. Ooga skips duplicates and matches each charge to the transaction you entered by hand with "Paid with" set.',
    tint: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  },
  {
    icon: TrendingUp,
    title: 'The trend, not just the total',
    body: 'Insights compares your budget with actual spending, tracks how fast each category is moving and shows who spends what, month after month.',
    tint: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  },
];
