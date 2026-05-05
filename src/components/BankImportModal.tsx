import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, Loader2, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  startImport,
  submitOtp,
  getImportStatus,
  type ImportStatus,
} from '../services/bankImportService';

interface Props {
  onClose: () => void;
  onImportComplete?: (imported: number) => void;
}

type Step = 'confirm' | 'logging_in' | 'awaiting_otp' | 'importing' | 'complete' | 'error';

const OTP_TIMEOUT_SECS = 120;

export default function BankImportModal({ onClose, onImportComplete }: Props) {
  const [step, setStep] = useState<Step>('confirm');
  const [months, setMonths] = useState(3);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(OTP_TIMEOUT_SECS);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittingOtp, setSubmittingOtp] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  // Poll for status updates
  const startPolling = useCallback((sid: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const status = await getImportStatus(sid);
        handleStatusUpdate(status.status, status.result, status.error);
      } catch {
        // transient failure — keep polling
      }
    }, 2000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusUpdate = (
    status: ImportStatus,
    res: { imported: number; skipped: number } | null,
    err: string | null
  ) => {
    if (status === 'awaiting_otp' && step !== 'awaiting_otp') {
      stopPolling();
      setStep('awaiting_otp');
      startOtpCountdown();
    } else if (status === 'importing') {
      setStep('importing');
    } else if (status === 'complete' && res) {
      stopPolling();
      setResult(res);
      setStep('complete');
      onImportComplete?.(res.imported);
    } else if (status === 'error') {
      stopPolling();
      setErrorMsg(err ?? 'An unexpected error occurred');
      setStep('error');
    }
  };

  const startOtpCountdown = () => {
    setOtpCountdown(OTP_TIMEOUT_SECS);
    countdownRef.current = setInterval(() => {
      setOtpCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleStart = async () => {
    setStep('logging_in');
    try {
      const sid = await startImport(months);
      setSessionId(sid);
      startPolling(sid);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to connect to scraper service');
      setStep('error');
    }
  };

  const handleOtpSubmit = async () => {
    if (!sessionId || !otp.trim()) return;
    setSubmittingOtp(true);
    try {
      await submitOtp(sessionId, otp.trim());
      setStep('importing');
      if (countdownRef.current) { clearInterval(countdownRef.current); }
      startPolling(sessionId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit OTP');
      setStep('error');
    } finally {
      setSubmittingOtp(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Import from Discount Bank
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {step === 'confirm' && (
            <ConfirmStep months={months} onMonthsChange={setMonths} onStart={handleStart} onCancel={onClose} />
          )}
          {step === 'logging_in' && (
            <SpinnerStep message="Connecting to Discount Bank…" detail="Logging in with your credentials" />
          )}
          {step === 'awaiting_otp' && (
            <OtpStep
              otp={otp}
              countdown={otpCountdown}
              submitting={submittingOtp}
              onChange={setOtp}
              onSubmit={handleOtpSubmit}
            />
          )}
          {step === 'importing' && (
            <SpinnerStep message="Importing transactions…" detail="This may take up to a minute" />
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

function ConfirmStep({
  months,
  onMonthsChange,
  onStart,
  onCancel,
}: {
  months: number;
  onMonthsChange: (m: number) => void;
  onStart: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Fetch transactions from your Discount Bank account and import them into Ooga.
        New transactions are added automatically — duplicates are skipped.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Import period
        </label>
        <select
          value={months}
          onChange={(e) => onMonthsChange(Number(e.target.value))}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
        >
          {[1, 2, 3, 6, 12].map((m) => (
            <option key={m} value={m}>
              Last {m} month{m > 1 ? 's' : ''}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-500">
        All imported transactions will be categorised as <strong>Uncategorized</strong> — you can edit them afterwards.
      </p>

      <div className="flex gap-3 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onStart}
          className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          Start Import
        </button>
      </div>
    </div>
  );
}

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

function OtpStep({
  otp,
  countdown,
  submitting,
  onChange,
  onSubmit,
}: {
  otp: string;
  countdown: number;
  submitting: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSubmit();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 py-2">
        <KeyRound className="w-10 h-10 text-amber-500" />
        <div className="text-center">
          <p className="font-medium text-gray-900 dark:text-white">Enter your OTP</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            A code was sent to your phone by Discount Bank
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={8}
        value={otp}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        onKeyDown={handleKey}
        placeholder="______"
        className="w-full text-center text-2xl tracking-[0.5em] font-mono rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-3"
      />

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>Code expires in</span>
        <span className={`font-medium ${countdown <= 30 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
          {countdown}s
        </span>
      </div>

      <button
        onClick={onSubmit}
        disabled={otp.length < 4 || submitting || countdown === 0}
        className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Confirm Code
      </button>

      {countdown === 0 && (
        <p className="text-xs text-center text-red-500">
          OTP expired. Please close and try again.
        </p>
      )}
    </div>
  );
}

function CompleteStep({
  result,
  onClose,
}: {
  result: { imported: number; skipped: number };
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <CheckCircle2 className="w-12 h-12 text-green-500" />
      <div className="text-center">
        <p className="font-semibold text-gray-900 dark:text-white text-lg">Import complete!</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          <span className="font-medium text-green-600">{result.imported}</span> transactions imported
          {result.skipped > 0 && (
            <>, <span className="font-medium">{result.skipped}</span> duplicates skipped</>
          )}
        </p>
        {result.imported > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            All imported transactions are marked <strong>Uncategorized</strong> — categorise them in the Transactions tab.
          </p>
        )}
      </div>
      <button
        onClick={onClose}
        className="w-full px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
      >
        Done
      </button>
    </div>
  );
}

function ErrorStep({
  message,
  onRetry,
  onClose,
}: {
  message: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <AlertCircle className="w-12 h-12 text-red-500" />
      <div className="text-center">
        <p className="font-semibold text-gray-900 dark:text-white">Import failed</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">{message}</p>
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
