import { FloatingShapes } from './LandingSections';

/**
 * The landing hero's soft brand gradient with drifting blobs, fixed behind the whole page so it
 * stays put while the content scrolls. No ancestor may start a stacking context (`isolate`, a
 * z-index, a transform): the page's windows that aren't portalled, such as the bank import
 * opened from Add transaction, must stack with the portalled ones at the top level.
 */
export function GlossyBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800" />
      <FloatingShapes />
    </div>
  );
}
