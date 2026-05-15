import { useState, useEffect } from 'react';
import { X, Download, Loader2, CheckCircle2, AlertCircle, PlusCircle } from 'lucide-react';
import {
  listConnections,
  requestCalOtpForConnection,
  importCalDirect,
  fetchImportedTransactions,
  deleteTransactions,
  type BankConnection,
} from '../services/bankImportService';
import ImportReviewStep from './ImportReviewStep';

interface Props {
  onClose: () => void;
  onImportComplete?: (imported: number) => void;
  onAddAccount?: () => void;
  /** Pre-select a connection and skip the account picker step. */
  selectedConnectionId?: string;
}

type Step = 'loading' | 'confirm' | 'no_accounts' | 'requesting_otp' | 'awaiting_otp' | 'importing' | 'review' | 'complete' | 'error';

export default function BankImportModal({ onClose, onImportComplete, onAddAccount, selectedConnectionId }: Props) {
  const [step, setStep] = useState<Step>('loading');
  const [months, setMonths] = useState(1);
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [dbSessionId, setDbSessionId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [calSessionToken, setCalSessionToken] = useState<string | null>(null);
  const [activeConnection, setActiveConnection] = useState<BankConnection | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpSubmitting, setOtpSubmitting] = useState(false);

  useEffect(() => {
    listConnections()
      .then((conns) => {
        setConnections(conns);
        if (conns.length === 0) {
          setStep('no_accounts');
        } else if (selectedConnectionId) {
          const preSelected = conns.find(c => c.id === selectedConnectionId) ?? conns[0];
          setActiveConnection(preSelected);
          startOtpRequest(preSelected);
        } else {
          setStep('confirm');
        }
      })
      .catch(() => setStep('confirm'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startOtpRequest = async (conn: BankConnection) => {
    setActiveConnection(conn);
    setStep('requesting_otp');
    try {
      const token = await requestCalOtpForConnection(conn);
      setCalSessionToken(token);
      setStep('awaiting_otp');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to request OTP');
      setStep('error');
    }
  };

  const handleStart = async () => {
    const conn = connections.find((c) => c.provider === 'visaCalFast') ?? connections[0];
    if (!conn) { setStep('no_accounts'); return; }
    await startOtpRequest(conn);
  };

  const handleOtpSubmit = async () => {
    if (!activeConnection || !calSessionToken || !otpCode.trim()) return;
    setOtpSubmitting(true);
    setStep('importing');
    try {
      const { dbSessionId: sid, imported, skipped } = await importCalDirect(
        activeConnection,
        calSessionToken,
        otpCode.trim(),
        months
      );
      setResult({ imported, skipped });
      setDbSessionId(sid ?? null);
      setStep(sid ? 'review' : 'complete');
      onImportComplete?.(imported);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Import failed');
      setStep('error');
    } finally {
      setOtpSubmitting(false);
    }
  };

  const providerLabel = (p: string) =>
    ({ discount: 'Discount Bank', visaCal: 'Visa Cal', visaCalFast: 'Visa Cal (Fast)', isracard: 'Isracard', max: 'Max', amex: 'Amex' }[p] ?? p);

  // When closing during review, delete all imported transactions first
  const handleClose = async () => {
    if (step === 'review' && dbSessionId) {
      try {
        const txns = await fetchImportedTransactions(dbSessionId);
        if (txns.length > 0) await deleteTransactions(txns.map(t => t.id));
      } catch { /* best-effort */ }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1100] p-4">
      <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full transition-all ${
        step === 'review' ? 'max-w-2xl' : 'max-w-md'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {step === 'review' ? 'Review Transactions' : 'Import from Bank'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {step === 'loading' && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          )}

          {step === 'no_accounts' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <AlertCircle className="w-10 h-10 text-amber-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">No accounts connected</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Add a bank or credit card account in Settings before importing.
                </p>
              </div>
              <div className="flex gap-3 w-full pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
                {onAddAccount && (
                  <button
                    onClick={() => { onClose(); onAddAccount(); }}
                    className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <PlusCircle className="w-4 h-4" /> Add Account
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              {connections.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Connected accounts ({connections.length})
                  </p>
                  <ul className="space-y-1">
                    {connections.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                        <span>{c.display_name}</span>
                        <span className="text-gray-400 dark:text-gray-500 text-xs">({providerLabel(c.provider)})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Import period
                </label>
                <select
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                >
                  {[1, 2, 3, 6, 12].map((m) => (
                    <option key={m} value={m}>Last {m} month{m > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-500">
                Imported transactions start as <strong>Uncategorized</strong>. Duplicates are skipped.
              </p>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStart}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                >
                  Start Import
                </button>
              </div>
            </div>
          )}

          {step === 'requesting_otp' && (
            <SpinnerStep message="Sending SMS code…" detail="Requesting a one-time code from Visa Cal" />
          )}

          {step === 'awaiting_otp' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2 pb-1 text-center">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <span className="text-xl">📱</span>
                </div>
                <p className="font-medium text-gray-900 dark:text-white">SMS verification required</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Visa Cal sent a one-time code to your registered phone. Enter it below to continue.
                </p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleOtpSubmit()}
                placeholder="Enter OTP code"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm text-center tracking-widest"
                autoFocus
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Import period
                </label>
                <select
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                >
                  {[1, 2, 3, 6, 12].map((m) => (
                    <option key={m} value={m}>{m === 1 ? 'This month only' : `Last ${m} months`}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleOtpSubmit}
                disabled={!otpCode.trim() || otpSubmitting}
                className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {otpSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Verify &amp; Import
              </button>
            </div>
          )}

          {step === 'importing' && (
            <SpinnerStep message="Importing transactions…" detail="Verifying OTP and fetching from Visa Cal — this may take up to 30 seconds" />
          )}

          {step === 'review' && result && dbSessionId && (
            <ImportReviewStep
              dbSessionId={dbSessionId}
              result={result}
              onDone={(kept) => {
                setResult((r) => r ? { ...r, imported: kept } : r);
                setStep('complete');
              }}
              onCancel={onClose}
            />
          )}
          {step === 'complete' && result && (
            <CompleteStep result={result} onClose={onClose} />
          )}
          {step === 'error' && (
            <ErrorStep message={errorMsg} onRetry={() => { setStep('confirm'); setErrorMsg(''); }} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SpinnerStep({ message, detail }: { message: string; detail: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      <div className="text-center">
        <p className="font-medium text-gray-900 dark:text-white">{message}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{detail}</p>
      </div>
    </div>
  );
}

function CompleteStep({ result, onClose }: { result: { imported: number; skipped: number }; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <CheckCircle2 className="w-12 h-12 text-green-500" />
      <div className="text-center">
        <p className="font-semibold text-gray-900 dark:text-white text-lg">Import complete!</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          <span className="font-medium text-green-600">{result.imported}</span> transactions imported
          {result.skipped > 0 && <>, <span className="font-medium">{result.skipped}</span> duplicates skipped</>}
        </p>
        {result.imported > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            All imported transactions are marked <strong>Uncategorized</strong> — categorise them in the Transactions tab.
          </p>
        )}
      </div>
      <button
        onClick={onClose}
        className="mt-2 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
      >
        Done
      </button>
    </div>
  );
}

function ErrorStep({ message, onRetry, onClose }: { message: string; onRetry: () => void; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <AlertCircle className="w-12 h-12 text-red-500" />
      <div className="text-center">
        <p className="font-semibold text-gray-900 dark:text-white">Import failed</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">{message}</p>
      </div>
      <div className="flex gap-3 w-full">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Close
        </button>
        <button
          onClick={onRetry}
          className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

