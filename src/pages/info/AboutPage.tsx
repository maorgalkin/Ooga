import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BookOpen } from 'lucide-react';
import { PublicLayout } from '../../components/info/PublicLayout';
import { HeroShowcase } from '../../components/info/HeroShowcase';
import { useAuth } from '../../contexts/AuthContext';
import { FEATURES } from '../../content/about';


/** Public page that explains what Ooga is and who it's for. */
export default function AboutPage() {
  const { user } = useAuth();
  const reduce = useReducedMotion();
  const rise = (delay = 0) =>
    reduce ? {} : { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { delay, duration: 0.5 } };

  return (
    <PublicLayout>
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800" />
        <div className="max-w-6xl mx-auto px-4 py-14 sm:py-20 grid gap-14 lg:grid-cols-2 lg:items-center">
          <motion.div {...rise()}>
            <p className="text-sm font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400">About Ooga</p>
            <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
              See where your money goes. Decide where it goes next.
            </h1>
            <p className="mt-5 text-lg text-gray-600 dark:text-gray-300">
              Ooga is a budgeting app for families. It brings everyone's spending into one place, so you get a real picture of
              where the money goes and stay in control of the bottom line every month.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/guide"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-3 font-medium text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
              >
                <BookOpen className="h-5 w-5" />
                Getting started guide
              </Link>
              <Link
                to={user ? '/' : '/register'}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-5 py-3 font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {user ? 'Open Ooga' : 'Create account'}
                <ArrowRight className="h-5 w-5 rtl:-scale-x-100" />
              </Link>
            </div>
          </motion.div>
          <div className="pb-8">
            <HeroShowcase />
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white text-center">Why families use Ooga</h2>
        <p className="mt-3 text-center text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Most budgets fail quietly: nobody knows the number until the month is over. Ooga keeps it in front of you while you can
          still do something about it.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body, tint }, i) => (
            <motion.div
              key={title}
              {...rise(i * 0.08)}
              className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}>
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-300">{body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 pb-20">
        <div className="relative isolate overflow-hidden rounded-3xl p-8 sm:p-10 text-center text-white shadow-xl">
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-purple-600 via-blue-600 to-green-600" />
          <h2 className="text-2xl sm:text-3xl font-bold">Ready when you are</h2>
          <p className="mt-3 text-white/90">The guide walks you through it step by step, from your household to your first trends.</p>
          <Link
            to="/guide"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white/20 backdrop-blur border border-white/40 px-5 py-3 font-medium hover:bg-white/30 transition-colors"
          >
            Start the guide
            <ArrowRight className="h-5 w-5 rtl:-scale-x-100" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
