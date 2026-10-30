import { useTranslation } from 'react-i18next';

const tile = 'rounded-2xl bg-gray-200/70 dark:bg-gray-800/70 motion-safe:animate-pulse';

/** Pulsing stand-ins for the Dashboard's tiles while the month's transactions are on their way. */
export function DashboardSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t('dashboard.loading')} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${tile} h-28`} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${tile} h-72`} />
        <div className={`${tile} h-72`} />
      </div>
    </div>
  );
}
