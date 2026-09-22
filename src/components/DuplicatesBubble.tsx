import { useEffect, useId, useRef, useState } from 'react';
import type { DuplicateSummary } from '../services/bankImportService';

interface Props {
  count: number;
  duplicates?: DuplicateSummary[]; // Older import paths only report the count
}

const formatDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/**
 * "N duplicates skipped" with a compact, scrollable list of those rows.
 * Opens on hover with a mouse and on tap/Enter otherwise; Escape or a click outside closes it.
 */
export default function DuplicatesBubble({ count, duplicates }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const lastPointerType = useRef<string>('');
  const bubbleId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const rows = [...(duplicates ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <span
      ref={containerRef}
      className="relative inline-block"
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setOpen(true); }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setOpen(false); }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bubbleId}
        onPointerDown={(e) => { lastPointerType.current = e.pointerType; }}
        onClick={() => {
          // Mouse users get it on hover; touch and keyboard toggle it
          if (lastPointerType.current !== 'mouse') setOpen((v) => !v);
          lastPointerType.current = '';
        }}
        className="text-gray-500 dark:text-gray-400 text-xs underline decoration-dotted underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200"
      >
        {count} duplicate{count !== 1 ? 's' : ''} skipped
      </button>

      {open && (
        <div
          id={bubbleId}
          role="dialog"
          aria-label="Skipped duplicates"
          className="absolute left-0 top-full z-20 mt-1.5 w-72 max-w-[calc(100vw-3rem)] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg"
        >
          {rows.length > 0 && (
            <ul className="max-h-44 overflow-y-auto overscroll-contain divide-y divide-gray-100 dark:divide-gray-700">
              {rows.map((d, i) => (
                <li key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                  <span className="w-12 flex-shrink-0 text-gray-400">{formatDate(d.date)}</span>
                  <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-200" dir="auto" title={d.description}>
                    {d.description}
                  </span>
                  <span className={`flex-shrink-0 tabular-nums ${d.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'}`}>
                    {d.type === 'income' ? '+' : '−'}₪{d.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="px-3 py-1.5 text-[11px] text-gray-400 border-t border-gray-100 dark:border-gray-700">
            Already in your account, so they weren’t imported again.
          </p>
        </div>
      )}
    </span>
  );
}
