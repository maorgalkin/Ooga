import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useT } from '../../hooks/useT';
import { Edit2, Trash2, CheckSquare } from 'lucide-react';
import { getCategoryColor } from '../../utils/categoryColors';
import type { Transaction, FamilyMember } from '../../types';
import type { PersonalBudget } from '../../types/budget';
import { getUserLocale } from '../../utils/locale';

interface TransactionsListProps {
  transactions: Transaction[];
  familyMembers: FamilyMember[];
  personalBudget: PersonalBudget | null | undefined;
  formatCurrency: (amount: number) => string;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransactions?: (ids: string[]) => Promise<void>;
  emptyMessage?: string;
}

/**
 * List of transaction cards with edit and bulk-delete functionality.
 */
export const TransactionsList: React.FC<TransactionsListProps> = ({
  transactions,
  familyMembers,
  personalBudget,
  formatCurrency,
  onEditTransaction,
  onDeleteTransactions,
  emptyMessage = 'No transactions available',
}) => {
  const t = useT();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartedRef = useRef(false);
  const pointerMoveThreshold = useRef(false);

  // Prevent context menu on long-press (mobile)
  useEffect(() => {
    const handler = (e: Event) => {
      if (pressTimerRef.current || pressStartedRef.current) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', handler, { passive: false });
    return () => document.removeEventListener('contextmenu', handler);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setConfirmDelete(false);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleDelete = useCallback(async () => {
    if (!onDeleteTransactions || selectedIds.size === 0) return;
    setDeleting(true);
    try {
      await onDeleteTransactions(Array.from(selectedIds));
      exitSelectionMode();
    } catch {
      setDeleting(false);
    }
  }, [onDeleteTransactions, selectedIds, exitSelectionMode]);

  const allSelected = transactions.length > 0 && selectedIds.size === transactions.length;

  if (transactions.length === 0) {
    return (
      <div className="text-gray-500 dark:text-gray-400 text-center py-8">{emptyMessage}</div>
    );
  }

  return (
    <>
      {/* List header row */}
      {onDeleteTransactions && (
        <div className="flex justify-between items-center mb-2">
          {selectionMode ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedIds(allSelected ? new Set() : new Set(transactions.map(tx => tx.id)))}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {allSelected ? t('transactions.list.deselectAll') : t('transactions.list.selectAll')}
              </button>
              <button
                onClick={exitSelectionMode}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSelectionMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <CheckSquare className="w-5 h-5" />
              {t('transactions.list.select')}
            </button>
          )}
        </div>
      )}

      <div className="grid gap-4">
        {transactions.map(tx => {
          const categoryColors = getCategoryColor(tx.category, tx.type, personalBudget);
          const isSelected = selectedIds.has(tx.id);

          return (
            <div
              key={tx.id}
              onClick={selectionMode ? () => toggleSelect(tx.id) : undefined}
              onPointerDown={e => {
                if (selectionMode) return;
                // Don't trigger long-press from the edit button
                if ((e.target as HTMLElement).closest('button[data-edit-btn]')) return;
                pressStartedRef.current = true;
                pointerMoveThreshold.current = false;
                pressTimerRef.current = setTimeout(() => {
                  pressTimerRef.current = null;
                  setSelectionMode(true);
                  setSelectedIds(new Set([tx.id]));
                }, 500);
              }}
              onPointerMove={() => {
                // Cancel long-press if pointer moves (prevents accidental triggers during scroll)
                if (!pointerMoveThreshold.current && pressTimerRef.current) {
                  pointerMoveThreshold.current = true;
                  clearTimeout(pressTimerRef.current);
                  pressTimerRef.current = null;
                }
              }}
              onPointerUp={() => {
                pressStartedRef.current = false;
                if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
              }}
              onPointerCancel={() => {
                pressStartedRef.current = false;
                if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
              }}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow border transition-shadow touch-manipulation select-none ${
                selectionMode ? 'cursor-pointer' : ''
              } ${
                isSelected
                  ? 'border-blue-500 dark:border-blue-400 ring-1 ring-blue-300 dark:ring-blue-700'
                  : 'border-gray-200 dark:border-gray-700 hover:shadow-md'
              } p-4`}
            >
              <div className="flex justify-between items-start gap-3">
                {/* Checkbox (selection mode only) */}
                {selectionMode && (
                  <div className="flex-shrink-0 flex items-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(tx.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 cursor-pointer accent-blue-600"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center mb-2">
                    <span
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border"
                      style={{
                        backgroundColor: categoryColors.bg,
                        borderColor: categoryColors.border,
                        color: categoryColors.text,
                      }}
                    >
                      {tx.category}
                    </span>
                  </div>
                  {tx.description && (
                    <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">{tx.description}</div>
                  )}
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(tx.date).toLocaleDateString(getUserLocale())}
                    {tx.familyMember && ` • ${familyMembers.find(m => m.id === tx.familyMember)?.name || t('transactions.filters.unknownMember')}`}
                    {tx.source === 'manual' && tx.paidWith && (
                      <span
                        className="ms-2 px-1.5 py-0.5 rounded text-[10px] font-medium border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
                        title={t('transactions.list.awaitingBankHint')}
                      >
                        {t('transactions.list.awaitingBank')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className={`font-bold text-lg ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </div>
                  {!selectionMode && (
                    <button
                      data-edit-btn
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTransaction(tx);
                      }}
                      className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                      title={t('transactions.list.edit')}
                      aria-label={t('transactions.list.edit')}
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bulk action bar — fixed at bottom when in selection mode */}
      {selectionMode && (
        <div className="fixed bottom-0 inset-x-0 z-40 flex items-center justify-between gap-3 px-4 py-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 shadow-lg">
          {confirmDelete ? (
            <>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">
                {t('transactions.list.confirmDelete', { count: selectedIds.size })}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white transition-colors flex items-center gap-1.5"
                >
                  {deleting ? t('common.deleting') : <><Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}</>}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedIds.size > 0 ? t('transactions.list.selected', { count: selectedIds.size }) : t('transactions.list.tapToSelect')}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={exitSelectionMode}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={selectedIds.size === 0}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('transactions.list.deleteSelected')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

