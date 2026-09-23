/**
 * Dashboard layout selection.
 *
 * Production always uses 'auto': the tiled layout on desktop, the wide (legacy) layout on phones.
 * The layout picker — including the 'both' side-by-side comparison — is only shown in development.
 */

export type LayoutMode = 'auto' | 'wide' | 'tiled' | 'both';
export type ResolvedLayout = Exclude<LayoutMode, 'auto'>;

export const SHOW_LAYOUT_PICKER = import.meta.env.DEV;

/** Tailwind's `md` breakpoint: the wide layout's phone-only sticky headers switch off here too */
export const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

const LAYOUT_MODES: LayoutMode[] = ['auto', 'wide', 'tiled', 'both'];

/** The saved dev choice, or 'auto'. Production ignores any saved choice. */
export function initialLayoutMode(saved: string | null, showPicker: boolean = SHOW_LAYOUT_PICKER): LayoutMode {
  return showPicker && LAYOUT_MODES.includes(saved as LayoutMode) ? (saved as LayoutMode) : 'auto';
}

export function resolveLayout(mode: LayoutMode, isDesktop: boolean): ResolvedLayout {
  if (mode !== 'auto') return mode;
  return isDesktop ? 'tiled' : 'wide';
}
