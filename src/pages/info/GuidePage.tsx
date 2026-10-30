import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Clock, Lightbulb } from 'lucide-react';
import { PublicLayout } from '../../components/info/PublicLayout';
import { GuideClip } from '../../components/info/GuideClip';
import { GUIDE_CHAPTERS, type GuideChapter } from '../../content/guide';

function ChapterNav({ current }: { current?: string }) {
  return (
    <nav aria-label="Guide chapters" className="lg:sticky lg:top-6">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Getting started</p>
      <ol className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {GUIDE_CHAPTERS.map((c, i) => {
          const active = c.slug === current;
          return (
            <li key={c.slug} className="shrink-0">
              <Link
                to={`/guide/${c.slug}`}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm min-h-[38px] transition-colors ${
                  active
                    ? 'bg-purple-100 font-semibold text-purple-800 dark:bg-purple-900/40 dark:text-purple-200'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    active ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="whitespace-nowrap lg:whitespace-normal">{c.title}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Overview() {
  const reduce = useReducedMotion();
  return (
    <>
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">Getting started with Ooga</h1>
      <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
        Five short chapters take you from an empty account to a clear picture of your family's spending. Each step shows the
        screen you'll see.
      </p>
      <ol className="mt-8 grid gap-4 sm:grid-cols-2">
        {GUIDE_CHAPTERS.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.li
              key={c.slug}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <Link
                to={`/guide/${c.slug}`}
                className="group flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.tint}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Chapter {i + 1}</span>
                </div>
                <h2 className="mt-3 font-semibold text-gray-900 dark:text-white">{c.title}</h2>
                <p className="mt-1 flex-1 text-sm text-gray-600 dark:text-gray-300">{c.summary}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-purple-700 dark:text-purple-300">
                  Read chapter <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </motion.li>
          );
        })}
      </ol>
    </>
  );
}

function Chapter({ chapter, index }: { chapter: GuideChapter; index: number }) {
  const prev = GUIDE_CHAPTERS[index - 1];
  const next = GUIDE_CHAPTERS[index + 1];
  const Icon = chapter.icon;

  return (
    <article>
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${chapter.tint}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Chapter {index + 1} of {GUIDE_CHAPTERS.length}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
          <Clock className="h-4 w-4" /> {chapter.minutes} min
        </span>
      </div>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{chapter.title}</h1>
      <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">{chapter.intro}</p>

      <ol className="mt-10 space-y-14">
        {chapter.steps.map((step, i) => (
          <li key={step.title} className="grid gap-6 md:grid-cols-5 md:items-start">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{step.title}</h2>
              </div>
              <div className="mt-3 space-y-3 text-gray-600 dark:text-gray-300">
                {step.body.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
              {step.tip && (
                <p className="mt-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                  <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{step.tip}</span>
                </p>
              )}
            </div>
            {step.clip && (
              <div className="md:col-span-3">
                <GuideClip frames={step.clip.frames} alt={step.clip.alt} />
              </div>
            )}
          </li>
        ))}
      </ol>

      <nav aria-label="Chapter navigation" className="mt-16 flex justify-between gap-4 border-t border-gray-200 pt-6 dark:border-gray-700">
        {prev ? (
          <Link to={`/guide/${prev.slug}`} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 min-h-[38px] text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">
            <ArrowLeft className="h-4 w-4" /> {prev.title}
          </Link>
        ) : (
          <Link to="/guide" className="inline-flex items-center gap-2 rounded-lg px-4 py-2 min-h-[38px] text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">
            <ArrowLeft className="h-4 w-4" /> Guide overview
          </Link>
        )}
        {next && (
          <Link
            to={`/guide/${next.slug}`}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 min-h-[38px] font-medium text-white shadow hover:shadow-lg"
          >
            {next.title} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </nav>
    </article>
  );
}

/** Public Getting started guide: an overview at /guide and one page per chapter at /guide/:chapter. */
export default function GuidePage() {
  const { chapter: slug } = useParams();
  const index = slug ? GUIDE_CHAPTERS.findIndex((c) => c.slug === slug) : -1;

  // Next/Previous land at the top of the new chapter, not where the old one was scrolled to
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (slug && index === -1) return <Navigate to="/guide" replace />;

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-4 py-10 grid gap-10 lg:grid-cols-[14rem_1fr]">
        <aside className="min-w-0">
          <ChapterNav current={slug} />
        </aside>
        <div className="min-w-0">{index === -1 ? <Overview /> : <Chapter key={slug} chapter={GUIDE_CHAPTERS[index]} index={index} />}</div>
      </div>
    </PublicLayout>
  );
}
