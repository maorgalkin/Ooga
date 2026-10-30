import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Clock, Lightbulb, Repeat } from 'lucide-react';
import { PublicLayout } from '../../components/info/PublicLayout';
import { GuideClip } from '../../components/info/GuideClip';
import { useAuth } from '../../contexts/AuthContext';
import { GUIDE_CHAPTERS, GUIDE_PARTS, partOf, type GuideChapter } from '../../content/guide';

const chapterBySlug = (slug: string) => GUIDE_CHAPTERS.find((c) => c.slug === slug)!;
const minutesFor = (slugs: string[]) => slugs.reduce((sum, s) => sum + chapterBySlug(s).minutes, 0);

function ChapterNav({ current }: { current?: string }) {
  return (
    <nav aria-label="Guide chapters" className="lg:sticky lg:top-6">
      <Link
        to="/guide"
        aria-current={current ? undefined : 'page'}
        className="mb-3 block text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-purple-700 dark:text-gray-400 dark:hover:text-purple-300"
      >
        Getting started
      </Link>
      <ol className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-4 lg:overflow-visible lg:pb-0">
        {GUIDE_PARTS.map((part) => (
          <li key={part.title} className="shrink-0">
            <p className="hidden px-3 pb-1 text-xs font-medium text-gray-500 dark:text-gray-400 lg:block">
              {part.title}
            </p>
            <ol className="flex gap-2 lg:flex-col lg:gap-0.5">
              {part.chapters.map((slug) => {
                const c = chapterBySlug(slug);
                const active = slug === current;
                // Numbered by chapter: phones hide the part labels, so part numbers would repeat
                const number = GUIDE_CHAPTERS.indexOf(c) + 1;
                return (
                  <li key={slug} className="shrink-0">
                    <Link
                      to={`/guide/${slug}`}
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
                        {number}
                      </span>
                      <span className="whitespace-nowrap lg:whitespace-normal">{c.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Welcome() {
  const reduce = useReducedMotion();
  const setupMinutes = minutesFor([...GUIDE_PARTS[0].chapters, ...GUIDE_PARTS[1].chapters]);
  const first = GUIDE_PARTS[0].chapters[0];

  return (
    <>
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">Less to learn than it looks</h1>
      <div className="mt-4 space-y-3 text-lg text-gray-600 dark:text-gray-300">
        <p>Ooga does a lot, but you don't need all of it on day one.</p>
        <p>
          The first two parts take about {setupMinutes} minutes to read, and you only do them once. After that, the
          day-to-day is a minute or two: add what you spent and glance at the Dashboard. Insights needs a few weeks of
          transactions, so come back to it whenever you're curious.
        </p>
      </div>

      <ol className="relative mt-10 space-y-5">
        {/* Joins the parts so they read as one path rather than four separate tasks */}
        <span aria-hidden className="absolute left-5 top-6 bottom-6 w-px bg-gradient-to-b from-purple-300 via-blue-300 to-amber-300 dark:from-purple-700 dark:via-blue-700 dark:to-amber-700" />
        {GUIDE_PARTS.map((part, p) => (
          <motion.li
            key={part.title}
            className="relative flex gap-4"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: p * 0.08 }}
          >
            <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-blue-600 font-bold text-white shadow">
              {p + 1}
            </span>
            <div className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{part.title}</h2>
              <p className="mt-1 text-gray-600 dark:text-gray-300">{part.purpose}</p>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <Repeat className="h-4 w-4" /> {part.cadence}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-4 w-4" /> {minutesFor(part.chapters)} min read
                </span>
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {part.chapters.map((slug) => {
                  const c = chapterBySlug(slug);
                  const Icon = c.icon;
                  return (
                    <li key={slug}>
                      <Link
                        to={`/guide/${slug}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 min-h-[38px] text-sm font-medium text-gray-800 hover:bg-purple-50 hover:text-purple-800 dark:bg-gray-900/50 dark:text-gray-200 dark:hover:bg-purple-900/30 dark:hover:text-purple-200"
                      >
                        <span className={`flex h-6 w-6 items-center justify-center rounded-md ${c.tint}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        {c.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.li>
        ))}
      </ol>

      <Link
        to={`/guide/${first}`}
        className="mt-10 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-3 font-medium text-white shadow hover:shadow-lg"
      >
        Start with part 1 <ArrowRight className="h-4 w-4" />
      </Link>
    </>
  );
}

function Chapter({ chapter, index }: { chapter: GuideChapter; index: number }) {
  const prev = GUIDE_CHAPTERS[index - 1];
  const next = GUIDE_CHAPTERS[index + 1];
  const Icon = chapter.icon;
  const part = partOf(chapter.slug);
  const { user } = useAuth();
  const steps = user ? chapter.steps.filter((s) => !s.signedOutOnly) : chapter.steps;

  return (
    <article>
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${chapter.tint}`}>
          <Icon className="h-5 w-5" />
        </span>
        {part && (
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            {part.title}
          </span>
        )}
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
          <Clock className="h-4 w-4" /> {chapter.minutes} min read
        </span>
      </div>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{chapter.title}</h1>
      <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">{chapter.intro}</p>

      <ol className="mt-10 space-y-14">
        {steps.map((step, i) => (
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
              {step.link && (
                <Link
                  to={step.link.to}
                  className="mt-3 inline-flex items-center gap-1 min-h-[38px] font-medium text-purple-700 hover:text-purple-600 dark:text-purple-300 dark:hover:text-purple-200"
                >
                  {step.link.label} <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              {step.tip && (
                <p className="mt-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                  <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{step.tip}</span>
                </p>
              )}
            </div>
            {step.clip && (
              <div className="md:col-span-3">
                <GuideClip frames={step.clip.frames} mobileFrames={step.clip.mobileFrames} alt={step.clip.alt} />
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

/** Public Getting started guide: a welcome page at /guide and one page per chapter at /guide/:chapter. */
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
        <div className="min-w-0">{index === -1 ? <Welcome /> : <Chapter key={slug} chapter={GUIDE_CHAPTERS[index]} index={index} />}</div>
      </div>
    </PublicLayout>
  );
}
