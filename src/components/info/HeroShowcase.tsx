import { useEffect, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { ShoppingCart, Fuel, Utensils, Baby } from 'lucide-react';
import { formatCurrencyFromSettings } from '../../utils/formatCurrency';

// Illustration only: a made-up month for a made-up family, in shekels like most households here.
const money = (n: number) => formatCurrencyFromSettings(n, { currency: 'ILS' });
const CATEGORIES = [
  { name: 'Groceries', spent: 2650, limit: 3200, bar: 'bg-green-500' },
  { name: 'Kids', spent: 1140, limit: 1200, bar: 'bg-blue-500' },
  { name: 'Dining out', spent: 980, limit: 900, bar: 'bg-red-500' },
  { name: 'Transportation', spent: 610, limit: 1100, bar: 'bg-purple-500' },
];
const FEED = [
  { icon: ShoppingCart, text: 'Shufersal', amount: 412, tint: 'text-green-600 bg-green-100 dark:bg-green-900/40 dark:text-green-300' },
  { icon: Fuel, text: 'Paz fuel', amount: 260, tint: 'text-purple-600 bg-purple-100 dark:bg-purple-900/40 dark:text-purple-300' },
  { icon: Utensils, text: 'Pizza night', amount: 148, tint: 'text-red-600 bg-red-100 dark:bg-red-900/40 dark:text-red-300' },
  { icon: Baby, text: 'Swimming lessons', amount: 320, tint: 'text-blue-600 bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300' },
];
const LEFT_THIS_MONTH = 4870;

function CountUp({ to }: { to: number }) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, to, { duration: 1.6, ease: 'easeOut', onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [to, reduce]);
  return <>{money(value)}</>;
}

/**
 * A lively, made-up snapshot of what Ooga shows a family: the month's bottom line, category
 * bars filling up and new transactions landing. Decorative, so it's hidden from screen readers.
 */
export function HeroShowcase() {
  const reduce = useReducedMotion();
  const [feedIndex, setFeedIndex] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const timer = setInterval(() => setFeedIndex((i) => (i + 1) % FEED.length), 2200);
    return () => clearInterval(timer);
  }, [reduce]);

  const item = FEED[feedIndex];
  const Icon = item.icon;

  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md select-none">
      {/* Soft brand-colored glow behind the cards */}
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-purple-400/30 via-blue-400/30 to-green-400/30 blur-2xl" />

      <motion.div
        className="rounded-2xl bg-white/90 dark:bg-gray-800/90 backdrop-blur shadow-2xl border border-white/60 dark:border-gray-700 p-5"
        initial={reduce ? false : { y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Left to spend this month</p>
        <p className="mt-1 text-3xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-green-600 bg-clip-text text-transparent">
          <CountUp to={LEFT_THIS_MONTH} />
        </p>

        <ul className="mt-4 space-y-3">
          {CATEGORIES.map((c, i) => {
            const pct = Math.min(100, Math.round((c.spent / c.limit) * 100));
            const over = c.spent > c.limit;
            return (
              <li key={c.name}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-200">{c.name}</span>
                  <span className={over ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}>
                    {money(c.spent)} / {money(c.limit)}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${c.bar}`}
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.4 + i * 0.15, duration: 0.9, ease: 'easeOut' }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </motion.div>

      {/* A new transaction drops in every couple of seconds */}
      <motion.div
        key={feedIndex}
        className="absolute -bottom-6 -left-4 sm:-left-10 flex items-center gap-3 rounded-xl bg-white dark:bg-gray-800 shadow-xl border border-gray-100 dark:border-gray-700 px-4 py-3"
        initial={reduce ? false : { y: 16, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.tint}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="text-sm">
          <p className="font-medium text-gray-900 dark:text-white">{item.text}</p>
          <p className="text-gray-500 dark:text-gray-400">{money(item.amount)}</p>
        </div>
      </motion.div>

      {/* Over-budget nudge bobbing gently in the corner */}
      <motion.div
        className="absolute -top-4 -right-2 sm:-right-6 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white shadow-lg"
        animate={reduce ? undefined : { y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
      >
        Dining out: over budget
      </motion.div>
    </div>
  );
}
