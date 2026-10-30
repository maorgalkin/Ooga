import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { LucideIcon } from 'lucide-react';
import { Home, PiggyBank, ReceiptText, SlidersHorizontal, TrendingUp } from 'lucide-react';
import type { ClipFrame } from '../components/info/GuideClip';
import FRAMES from './guide-frames.json';
import MOBILE_FRAMES from './guide-frames.mobile.json';
import HE_FRAMES from './guide-frames.he.json';
import HE_MOBILE_FRAMES from './guide-frames.he.mobile.json';

export interface GuideStep {
  /** Stable key for the step's text in src/i18n/locales/guide.*.json. */
  id: string;
  title: string;
  body: string[];
  tip?: string;
  clip?: { alt: string; frames: ClipFrame[]; mobileFrames?: ClipFrame[] };
  /** Where in the app to do this step; shown at the end of the step's text. */
  link?: { label: string; to: string };
  /** The step "How it works" on the sign-in page shows for this chapter. */
  featured?: boolean;
  /** Only for people who aren't signed in yet, such as creating an account. */
  signedOutOnly?: boolean;
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
  id: string;
  title: string;
  /** How often the reader comes back to this part, e.g. "Once". */
  cadence: string;
  purpose: string;
  /** Chapter slugs, in reading order. */
  chapters: string[];
}

// The guide's shape: everything but the words, which live in src/i18n/locales/guide.*.json
// under chapters.<slug>.steps.<id> and parts.<id>.
interface StepShape {
  id: string;
  /** Frame keys, in playing order. */
  clip?: string[];
  /** Where the step's link goes; its label is the step's `link` text. */
  to?: string;
  featured?: boolean;
  signedOutOnly?: boolean;
}
type ChapterShape = Omit<GuideChapter, 'title' | 'summary' | 'intro' | 'steps'> & { steps: StepShape[] };

// Screenshots come from a made-up demo household, never a real account, and are
// regenerated with scripts/demo/capture-guide.mjs, which also records where the pointer
// and highlight go on each frame in guide-frames.json (guide-frames.mobile.json for phones;
// guide-frames.he*.json for the Hebrew app, captured with --lang he).
type FrameSet = Record<string, ClipFrame>;
const SETS: Record<string, { desktop: FrameSet; mobile: FrameSet }> = {
  en: { desktop: FRAMES as FrameSet, mobile: MOBILE_FRAMES as FrameSet },
  he: { desktop: HE_FRAMES as FrameSet, mobile: HE_MOBILE_FRAMES as FrameSet },
};
// A set is used for a clip only when it has every frame of it, so a clip never mixes two sets
const all = (set: FrameSet, keys: string[]) => {
  const found = keys.map((k) => set[k]);
  return found.every(Boolean) ? found : undefined;
};
const clip = (alt: string, keys: string[], language: string) => {
  // The reader's language first; English, the complete set, otherwise
  const own = language !== 'en' ? SETS[language] : undefined;
  return {
    alt,
    frames: (own && all(own.desktop, keys)) ?? keys.map((k) => SETS.en.desktop[k]),
    mobileFrames: (own && all(own.mobile, keys)) ?? all(SETS.en.mobile, keys),
  };
};

const BUDGET_SETTINGS = '/?tab=budget&subtab=settings';

/** The guide's chapters in reading order: slugs, screenshots, links and icons. */
export const GUIDE_CHAPTERS: ChapterShape[] = [
  {
    slug: 'household',
    minutes: 3,
    icon: Home,
    tint: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    landing: true,
    steps: [
      { id: 'create-account', clip: ['household/register-1', 'household/register-2', 'household/register-3'], to: '/register', signedOutOnly: true },
      { id: 'name-and-family', clip: ['household/dashboard-empty', 'household/rename', 'household/members'], to: '/' },
      { id: 'invite-partner', clip: ['household/invite', 'household/switch'], featured: true },
    ],
  },
  {
    slug: 'budget',
    minutes: 3,
    icon: PiggyBank,
    tint: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    landing: true,
    steps: [
      { id: 'start', clip: ['budget/tab', 'budget/defaults'], to: '/?tab=budget&create=true' },
      { id: 'make-it-yours', clip: ['budget/edit-category', 'budget/add-category', 'budget/save', 'budget/saved'], featured: true },
    ],
  },
  {
    slug: 'transactions',
    minutes: 4,
    icon: ReceiptText,
    tint: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    landing: true,
    steps: [
      { id: 'add', clip: ['transactions/modal', 'transactions/categories', 'transactions/filled', 'transactions/income'], featured: true },
      { id: 'installments', clip: ['transactions/installments'] },
      { id: 'connect', clip: ['transactions/accounts', 'transactions/providers'], to: BUDGET_SETTINGS },
      { id: 'import' },
      { id: 'fix', clip: ['transactions/list'], to: '/?tab=transactions' },
      { id: 'dashboard', clip: ['insights/dashboard', 'insights/dashboard-chart'], to: '/' },
    ],
  },
  {
    slug: 'update-budget',
    minutes: 3,
    icon: SlidersHorizontal,
    tint: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    steps: [
      { id: 'check', clip: ['update-budget/overview'], to: '/?tab=budget' },
      { id: 'change-limit', clip: ['update-budget/categories', 'update-budget/details', 'update-budget/adjust'], to: '/?tab=budget&subtab=categories' },
      { id: 'tidy', clip: ['update-budget/merge'] },
      { id: 'history', clip: ['update-budget/history'], to: BUDGET_SETTINGS },
    ],
  },
  {
    slug: 'insights',
    minutes: 2,
    icon: TrendingUp,
    tint: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    landing: true,
    steps: [
      { id: 'compare', clip: ['insights/range', 'insights/summary', 'insights/chart'], to: '/?tab=insights', featured: true },
      { id: 'drift', clip: ['insights/accuracy', 'insights/pace'] },
      { id: 'members', clip: ['insights/members'] },
    ],
  },
];

/** The guide's four parts, which group the chapters by how often you need them. */
export const GUIDE_PARTS: Pick<GuidePart, 'id' | 'chapters'>[] = [
  { id: 'household', chapters: ['household'] },
  { id: 'budget', chapters: ['budget'] },
  { id: 'day-to-day', chapters: ['transactions', 'update-budget'] },
  { id: 'deeper', chapters: ['insights'] },
];

/**
 * The guide with its words, in the language `t` speaks (a `t` for the `guide` namespace), and its
 * screenshots in `language` where that set has them.
 */
export function localizeGuide(t: TFunction, language = 'en'): { chapters: GuideChapter[]; parts: GuidePart[] } {
  const chapters = GUIDE_CHAPTERS.map((shape) => {
    const at = `chapters.${shape.slug}`;
    return {
      ...shape,
      title: t(`${at}.title`),
      summary: t(`${at}.summary`),
      intro: t(`${at}.intro`),
      steps: shape.steps.map(({ id, clip: keys, to, featured, signedOutOnly }) => {
        const step = `${at}.steps.${id}`;
        const has = (field: string) => t(`${step}.${field}`, { defaultValue: '' }) !== '';
        return {
          id,
          title: t(`${step}.title`),
          body: t(`${step}.body`, { returnObjects: true }) as string[],
          tip: has('tip') ? t(`${step}.tip`) : undefined,
          clip: keys ? clip(t(`${step}.alt`), keys, language) : undefined,
          link: to ? { label: t(`${step}.link`), to } : undefined,
          featured,
          signedOutOnly,
        };
      }),
    };
  });
  const parts = GUIDE_PARTS.map(({ id, chapters: slugs }) => ({
    id,
    title: t(`parts.${id}.title`),
    cadence: t(`parts.${id}.cadence`),
    purpose: t(`parts.${id}.purpose`),
    chapters: slugs,
  }));
  return { chapters, parts };
}

/** The guide in the current language; re-renders when the language changes. */
export function useGuide() {
  const { t, i18n } = useTranslation('guide');
  return useMemo(() => localizeGuide(t, i18n.language), [t, i18n.language]);
}

/** The part a chapter belongs to. */
export function partOf(parts: GuidePart[], slug: string) {
  return parts.find((p) => p.chapters.includes(slug));
}
