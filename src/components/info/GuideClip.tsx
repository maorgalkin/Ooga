import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MousePointer2 } from 'lucide-react';

/** One still in a clip. Positions are percentages of the image, so they survive resizing. */
export interface ClipFrame {
  src: string;
  /** The image's size in CSS pixels; only the ratio matters. */
  size: { w: number; h: number };
  /** Where the pointer rests on this frame; a click ripple plays there. */
  pointer?: { x: number; y: number };
  /** Area to outline, e.g. the button the step is about. */
  highlight?: { x: number; y: number; w: number; h: number };
}

interface GuideClipProps {
  frames: ClipFrame[];
  /** Describes the whole clip for screen readers. */
  alt: string;
  /** Milliseconds each frame stays on screen. */
  interval?: number;
  className?: string;
}

// Frames are cropped differently (a whole screen, then a tall dialog), so the clip keeps one
// box and fits each frame inside it. This is where a frame lands, in percent of the box.
function fit(frame: ClipFrame, boxRatio: number) {
  const ratio = frame.size.w / frame.size.h;
  if (ratio < boxRatio) {
    const width = (ratio / boxRatio) * 100;
    return { left: (100 - width) / 2, top: 0, width, height: 100 };
  }
  const height = (boxRatio / ratio) * 100;
  return { left: 0, top: (100 - height) / 2, width: 100, height };
}

/**
 * Plays real screenshots as a short looping walkthrough: frames cross-fade while a pointer
 * glides to the next control and "clicks" it. Built from stills rather than video so the
 * guide stays small, sharp at any width and easy to refresh when a screen changes. Holds on
 * the first frame when the reader prefers reduced motion or the clip is off screen.
 */
export function GuideClip({ frames: given, alt, interval = 2000, className = '' }: GuideClipProps) {
  const reduceMotion = useReducedMotion();
  // A single still with a target still plays: first the plain screen, then the pointer arrives
  const frames = given.length === 1 && given[0].pointer ? [{ src: given[0].src, size: given[0].size }, given[0]] : given;
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const animate = !reduceMotion && frames.length > 1;

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!animate || !visible) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % frames.length), interval);
    return () => clearInterval(timer);
  }, [animate, visible, frames.length, interval]);

  // The box takes the widest frame's shape, capped so a tall dialog never towers over the text
  const boxRatio = Math.max(0.9, ...frames.map((f) => f.size.w / f.size.h));
  const frame = frames[animate ? index : 0];
  const area = fit(frame, boxRatio);
  const at = (x: number, y: number) => ({ left: `${area.left + (x * area.width) / 100}%`, top: `${area.top + (y * area.height) / 100}%` });
  const screens = new Set(frames.map((f) => f.src)).size;

  return (
    <div
      ref={ref}
      role="img"
      aria-label={alt}
      style={{ aspectRatio: boxRatio }}
      className={`relative w-full overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 shadow-xl dark:border-gray-700 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700 ${className}`}
    >
      <AnimatePresence initial={false}>
        <motion.img
          key={frame.src}
          src={frame.src}
          alt=""
          loading="lazy"
          className="absolute rounded-md shadow-md"
          style={{ left: `${area.left}%`, top: `${area.top}%`, width: `${area.width}%`, height: `${area.height}%` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
        />
      </AnimatePresence>

      {animate && frame.highlight && (
        <motion.div
          key={`hl-${index}`}
          aria-hidden
          className="pointer-events-none absolute rounded-lg ring-4 ring-purple-500/70"
          style={{
            ...at(frame.highlight.x, frame.highlight.y),
            width: `${(frame.highlight.w * area.width) / 100}%`,
            height: `${(frame.highlight.h * area.height) / 100}%`,
          }}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.3 }}
        />
      )}

      {animate && frame.pointer && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute"
          initial={{ left: '88%', top: '92%' }}
          animate={at(frame.pointer.x, frame.pointer.y)}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        >
          <motion.span
            key={`ripple-${index}`}
            className="absolute -left-4 -top-4 h-8 w-8 rounded-full bg-purple-500/40"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.4], opacity: [0, 0.8, 0] }}
            transition={{ delay: 0.65, duration: 0.6 }}
          />
          <MousePointer2 className="h-6 w-6 -translate-x-1 -translate-y-1 fill-white text-gray-900 drop-shadow" />
        </motion.div>
      )}

      {animate && screens > 1 && (
        <div aria-hidden className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          {frames.map((_frame, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-purple-600' : 'w-1.5 bg-gray-400/60'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
