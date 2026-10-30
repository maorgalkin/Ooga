import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { FEATURES } from '../../content/about';
import { GUIDE_CHAPTERS } from '../../content/guide';
import { GuideClip } from './GuideClip';

const BLOBS = [
  { className: 'left-[-6rem] top-[-4rem] h-72 w-72 bg-purple-400/30', drift: { x: [0, 30, 0], y: [0, 20, 0] } },
  { className: 'right-[-5rem] top-24 h-80 w-80 bg-green-400/25', drift: { x: [0, -25, 0], y: [0, 30, 0] } },
  { className: 'left-1/3 bottom-[-6rem] h-72 w-72 bg-blue-400/25', drift: { x: [0, 20, 0], y: [0, -25, 0] } },
];

/** Slowly drifting brand-colored blobs behind the landing hero. */
export function FloatingShapes() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {BLOBS.map((b, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full blur-3xl ${b.className}`}
          animate={reduce ? undefined : b.drift}
          transition={{ repeat: Infinity, duration: 14 + i * 3, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/** Everything below the sign-in hero: what Ooga does, how it works, and where to start. */
export function LandingSections() {
  const reduce = useReducedMotion();
  const rise = (delay = 0) =>
    reduce ? {} : { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { delay, duration: 0.5 } };
  const showcase = GUIDE_CHAPTERS.filter((c) => c.landing);

  return (
    <>
      <section className="max-w-6xl mx-auto px-4 py-16">
        <motion.h2 {...rise()} className="text-center text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Everything a family budget needs
        </motion.h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body, tint }, i) => (
            <motion.div
              key={title}
              {...rise(i * 0.08)}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800"
            >
              <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}>
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-semibold text-gray-900 dark:text-white">{title}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {showcase.length > 0 && (
        <section className="bg-white dark:bg-gray-800/50 border-y border-gray-200 dark:border-gray-800">
          <div className="max-w-6xl mx-auto px-4 py-16">
            <motion.h2 {...rise()} className="text-center text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              How it works
            </motion.h2>
            <div className="mt-12 space-y-16">
              {showcase.map((chapter, i) => {
                const step = chapter.steps.find((s) => s.featured) ?? chapter.steps.find((s) => s.clip);
                return (
                  <motion.div key={chapter.slug} {...rise()} className="grid gap-8 md:grid-cols-2 md:items-center">
                    <div className={i % 2 ? 'md:order-2' : ''}>
                      <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">Step {i + 1}</span>
                      <h3 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{chapter.title}</h3>
                      <p className="mt-3 text-gray-600 dark:text-gray-300">{chapter.summary}</p>
                      <Link
                        to={`/guide/${chapter.slug}`}
                        className="mt-4 inline-flex items-center gap-1 font-medium text-purple-700 hover:text-purple-600 dark:text-purple-300"
                      >
                        See how <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                    {step?.clip && <GuideClip frames={step.clip.frames} mobileFrames={step.clip.mobileFrames} alt={step.clip.alt} />}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="max-w-4xl mx-auto px-4 py-16">
        <motion.div {...rise()} className="relative isolate overflow-hidden rounded-3xl p-8 sm:p-10 text-center text-white shadow-xl">
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-purple-600 via-blue-600 to-green-600" />
          <h2 className="text-2xl sm:text-3xl font-bold">New to Ooga?</h2>
          <p className="mt-3 text-white/90">Create your account in a minute; your household comes with it. The guide shows you every step.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="rounded-lg bg-white px-5 py-3 font-medium text-purple-700 shadow hover:shadow-lg">
              Create account
            </Link>
            <Link to="/guide" className="rounded-lg border border-white/50 bg-white/15 px-5 py-3 font-medium backdrop-blur hover:bg-white/25">
              Read the guide
            </Link>
          </div>
        </motion.div>
      </section>
    </>
  );
}
