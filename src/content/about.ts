import { Users, PiggyBank, Landmark, TrendingUp } from 'lucide-react';

/**
 * What Ooga does, in four cards; shared by the About page and the sign-in landing page.
 * Their words are under about.features.<id> in src/i18n/locales.
 */
export const FEATURES = [
  { id: 'household', icon: Users, tint: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  { id: 'budget', icon: PiggyBank, tint: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  { id: 'bank', icon: Landmark, tint: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  { id: 'trends', icon: TrendingUp, tint: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
];
