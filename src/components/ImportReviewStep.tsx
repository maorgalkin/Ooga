import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { useCategories } from '../hooks/useCategories';
import {
  fetchImportedTransactions,
  updateTransactionCategory,
  deleteTransactions,
  type ReviewTransaction,
} from '../services/bankImportService';
import type { Category } from '../types/category';

interface Props {
  dbSessionId: string;
  result: { imported: number; skipped: number };
  onDone: (kept: number) => void;
  onCancel: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatAmount(tx: ReviewTransaction, currency: string): string {
  const sign = tx.type === 'expense' ? '-' : '+';
  const base = `${sign}${currency}${tx.amount.toFixed(2)}`;
  if (tx.original_currency && tx.original_currency !== 'ILS' && tx.original_amount) {
    return `${base} (${tx.original_currency} ${tx.original_amount.toFixed(2)})`;
  }
  return base;
}

export default function ImportReviewStep({ dbSessionId, result, onDone, onCancel }: Props) {
  const [transactions, setTransactions] = useState<ReviewTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Which transaction IDs are checked (= will be kept)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Per-transaction category overrides: txId → { id, name }
  const [categoryOverrides, setCategoryOverrides] = useState<Map<string, { id: string | null; name: string }>>(new Map());
  // Bulk category apply
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);

  const { data: categories = [] } = useCategories(false);
  const expenseCategories = categories.filter((c: Category) => c.isActive);

  useEffect(() => {
    fetchImportedTransactions(dbSessionId)
      .then((txns) => {
        setTransactions(txns);
        setSelected(new Set(txns.map((t) => t.id)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load transactions'))
      .finally(() => setLoading(false));
  }, [dbSessionId]);

  const toggleAll = useCallback((checked: boolean) => {
    setSelected(checked ? new Set(transactions.map((t) => t.id)) : new Set());
  }, [transactions]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setCategoryForTx = useCallback((txId: string, catId: string, catName: string) => {
    setCategoryOverrides((prev) => new Map(prev).set(txId, { id: catId || null, name: catName }));
  }, []);

  const applyBulkCategory = useCallback(() => {
    if (!bulkCategoryId) return;
    const cat = expenseCategories.find((c: Category) => c.id === bulkCategoryId);
    if (!cat) return;
    const updates = new Map(categoryOverrides);
    transactions.forEach((tx) => {
      const current = categoryOverrides.get(tx.id);
      const effectiveName = current?.name ?? tx.category;
      if (effectiveName === 'Uncategorized' || !effectiveName) {
        updates.set(tx.id, { id: cat.id, name: cat.name });
      }
    });
    setCategoryOverrides(updates);
    setBulkCategoryId('');
  }, [bulkCategoryId, expenseCategories, transactions, categoryOverrides]);

  const handleAccept = useCallback(async () => {
    setSaving(true);
    try {
      const toDelete = transactions.filter((t) => !selected.has(t.id)).map((t) => t.id);
      await deleteTransactions(toDelete);

      const updatePromises = Array.from(categoryOverrides.entries()).map(([id, cat]) =>
        updateTransactionCategory(id, cat.id, cat.name)
      );
      await Promise.all(updatePromises);

      onDone(selected.size);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save changes');
      setSaving(false);
    }
  }, [transactions, selected, categoryOverrides, onDone]);

  const handleCancel = useCallback(async () => {
    setSaving(true);
    try {
      await deleteTransactions(transactions.map((t) => t.id));
      onCancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel import');
      setSaving(false);
    }
  }, [transactions, onCancel]);

  const allChecked = transactions.length > 0 && selected.size === transactions.length;
  const someChecked = selected.size > 0 && selected.size < transactions.length;

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading transactions…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={onCancel}
          className="mt-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Summary banner */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
        <span className="text-green-700 dark:text-green-300 text-sm font-medium">
          {result.imported > 0
            ? `${result.imported} new transaction${result.imported !== 1 ? 's' : ''} fetched`
            : 'No new transactions'}
        </span>
        {result.skipped > 0 && (
          <span className="text-gray-500 dark:text-gray-400 text-xs">
            · {result.skipped} duplicate{result.skipped !== 1 ? 's' : ''} skipped
          </span>
        )}
      </div>

      {transactions.length > 0 && (
        <>
          {/* Bulk category + select-all row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400">Apply to uncategorized:</span>
            <select
              value={bulkCategoryId}
              onChange={(e) => setBulkCategoryId(e.target.value)}
              className="flex-1 min-w-0 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs px-2 py-1"
            >
              <option value="">— pick category —</option>
              {expenseCategories.map((c: Category) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={applyBulkCategory}
              disabled={!bulkCategoryId}
              className="px-2 py-1 rounded text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors"
            >
              Apply
            </button>
          </div>

          {/* Transaction list */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {/* Desktop table header */}
            <div className="hidden sm:grid sm:grid-cols-[32px_70px_1fr_110px_150px] items-center gap-1 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => { if (el) el.indeterminate = someChecked; }}
                onChange={(e) => toggleAll(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <span>Date</span>
              <span>Description</span>
              <span className="text-right">Amount</span>
              <span>Category</span>
            </div>

            {/* Mobile select-all row */}
            <div className="sm:hidden flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => { if (el) el.indeterminate = someChecked; }}
                onChange={(e) => toggleAll(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Select all</span>
            </div>

            {/* Scrollable rows */}
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/50">
              {transactions.map((tx) => {
                const override = categoryOverrides.get(tx.id);
                const displayCategoryId = override?.id ?? tx.category_id ?? '';
                const isChecked = selected.has(tx.id);

                return (
                  <div
                    key={tx.id}
                    onClick={() => toggleOne(tx.id)}
                    className={`px-3 py-2 transition-colors cursor-pointer ${
                      isChecked
                        ? 'bg-white dark:bg-gray-800'
                        : 'bg-gray-50 dark:bg-gray-800/40 opacity-60'
                    }`}
                  >
                    {/* Desktop row */}
                    <div className="hidden sm:grid sm:grid-cols-[32px_70px_1fr_60px_110px_150px] items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(tx.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <span className="text-gray-500 dark:text-gray-400 text-xs tabular-nums">
                        {formatDate(tx.date)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-gray-900 dark:text-gray-100 text-xs font-medium">
                          {tx.description}
                        </p>
                        {tx.installment_number && tx.installment_total && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            installment {tx.installment_number}/{tx.installment_total}
                          </span>
                        )}
                        {tx.memo && (
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{tx.memo}</p>
                        )}
                      </div>
                      {/* Card badge */}
                      {tx.bank_card_last4 ? (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums text-center self-center">
                          ···· {tx.bank_card_last4}
                        </span>
                      ) : <span />}
                      <span className={`text-right text-xs tabular-nums font-medium ${
                        tx.type === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}>
                        {formatAmount(tx, '₪')}
                      </span>
                      <select
                        value={displayCategoryId}
                        onChange={(e) => {
                          const cat = expenseCategories.find((c: Category) => c.id === e.target.value);
                          if (cat) setCategoryForTx(tx.id, cat.id, cat.name);
                          else setCategoryForTx(tx.id, '', 'Uncategorized');
                        }}
                        disabled={!isChecked}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs px-1 py-1 disabled:opacity-40"
                      >
                        <option value="">Uncategorized</option>
                        {expenseCategories.map((c: Category) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Mobile row — two-line card */}
                    <div className="sm:hidden flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(tx.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 mt-0.5 cursor-pointer flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate text-gray-900 dark:text-gray-100 text-xs font-medium">
                            {tx.description}
                          </p>
                          <span className={`flex-shrink-0 text-xs tabular-nums font-semibold ${
                            tx.type === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                          }`}>
                            {formatAmount(tx, '₪')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums flex-shrink-0">
                            {formatDate(tx.date)}
                          </span>
                          {tx.bank_card_last4 && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums flex-shrink-0">
                              ···· {tx.bank_card_last4}
                            </span>
                          )}
                          {tx.installment_number && tx.installment_total && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                              {tx.installment_number}/{tx.installment_total}
                            </span>
                          )}
                          {tx.memo && (
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{tx.memo}</p>
                          )}
                        </div>
                        <select
                          value={displayCategoryId}
                          onChange={(e) => {
                            const cat = expenseCategories.find((c: Category) => c.id === e.target.value);
                            if (cat) setCategoryForTx(tx.id, cat.id, cat.name);
                            else setCategoryForTx(tx.id, '', 'Uncategorized');
                          }}
                          disabled={!isChecked}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs px-1 py-0.5 disabled:opacity-40"
                        >
                          <option value="">Uncategorized</option>
                          {expenseCategories.map((c: Category) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Unchecked rows will be <strong>deleted</strong>. You can always re-import later.
          </p>
        </>
      )}

      {/* Duplicates section */}
      {result.skipped > 0 && (
        <button
          onClick={() => setDuplicatesOpen((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors w-full text-left"
        >
          {duplicatesOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {result.skipped} duplicate{result.skipped !== 1 ? 's' : ''} already in your account — skipped
        </button>
      )}
      {duplicatesOpen && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>
            {result.skipped} transaction{result.skipped !== 1 ? 's were' : ' was'} skipped because identical records already exist in your account (matched by date + amount + description).
          </p>
          <p>
            To review them, use the <strong>month filter</strong> in the Transactions tab after closing this.
          </p>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleCancel}
          disabled={saving}
          className="flex-1 px-3 py-2 rounded-lg border border-red-300 dark:border-red-700 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 transition-colors"
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Cancelling…</> : 'Cancel Import'}
        </button>
        <button
          onClick={handleAccept}
          disabled={saving}
          className="flex-1 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          ) : (
            `Accept ${selected.size} transaction${selected.size !== 1 ? 's' : ''}`
          )}
        </button>
      </div>
    </div>
  );
}
