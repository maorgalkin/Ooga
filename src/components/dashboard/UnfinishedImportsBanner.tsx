import { useState } from 'react';
import { Download } from 'lucide-react';
import { useT } from '../../hooks/useT';
import { useUnfinishedImports } from '../../hooks/useUnfinishedImports';
import { reopenImport } from '../../services/bankImportService';
import { useFinance } from '../../context/FinanceContext';
import { getUserLocale } from '../../utils/locale';
import BankImportModal from '../BankImportModal';

/**
 * Imports the person postponed with "Finish later": their rows wait in the holding area and aren't
 * in the budget yet. Each one reopens its review.
 */
export function UnfinishedImportsBanner() {
  const t = useT();
  const { data: unfinished = [] } = useUnfinishedImports();
  const { refreshTransactions } = useFinance();
  const [reviewing, setReviewing] = useState<string | null>(null);

  if (unfinished.length === 0 && !reviewing) return null;

  return (
    <>
      {unfinished.length > 0 && (
        <section
          aria-label={t('import.unfinished.label')}
          className="mb-4 space-y-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2"
        >
          {unfinished.map((item) => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <Download className="h-4 w-4 flex-shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
              <p className="flex-1 min-w-0 text-amber-900 dark:text-amber-100">
                {t('import.unfinished.body', {
                  count: item.rows,
                  account: item.connectionName ?? t('import.unfinished.yourAccount'),
                  date: new Date(item.startedAt).toLocaleDateString(getUserLocale(), { month: 'short', day: 'numeric' }),
                })}
              </p>
              <button
                type="button"
                onClick={async () => {
                  // An import that stopped while fetching is marked fetched first, so it can be imported
                  if (item.stalled) await reopenImport(item.id).catch(() => {});
                  setReviewing(item.id);
                }}
                className="flex-shrink-0 min-h-[32px] rounded-md bg-amber-600 px-3 text-xs font-medium text-white hover:bg-amber-700"
              >
                {t('import.unfinished.review')}
              </button>
            </div>
          ))}
        </section>
      )}
      {reviewing && (
        <BankImportModal
          resumeSessionId={reviewing}
          onClose={() => setReviewing(null)}
          onImportComplete={() => void refreshTransactions()}
        />
      )}
    </>
  );
}
