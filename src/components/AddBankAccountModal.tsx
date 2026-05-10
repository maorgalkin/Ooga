import { useState } from 'react';
import { X, Building2, CreditCard, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { addConnection } from '../services/bankImportService';

interface Props {
  onClose: () => void;
  onAdded?: () => void;
}

type Provider = {
  id: string;
  label: string;
  icon: 'bank' | 'card';
  fields: CredentialField[];
};

type CredentialField = {
  key: string;
  label: string;
  placeholder: string;
  type: 'text' | 'password';
  inputMode?: 'numeric' | 'text';
  hint?: string;
};

const PROVIDERS: Provider[] = [
  {
    id: 'discount',
    label: 'Discount Bank',
    icon: 'bank',
    fields: [
      { key: 'id', label: 'National ID (ת.ז.)', placeholder: '123456789', type: 'text', inputMode: 'numeric' },
      { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
      { key: 'num', label: 'Access Code (קוד גישה)', placeholder: '6-character code', type: 'text', hint: 'The code shown on the login page, not your SMS OTP' },
    ],
  },
  {
    id: 'visaCal',
    label: 'Visa Cal',
    icon: 'card',
    fields: [
      { key: 'username', label: 'Username', placeholder: 'Your Cal username', type: 'text' },
      { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
    ],
  },
  {
    id: 'visaCalFast',
    label: 'Visa Cal (Fast Access)',
    icon: 'card',
    fields: [
      { key: 'id', label: 'National ID (ת.ז.)', placeholder: '123456789', type: 'text', inputMode: 'numeric' },
      { key: 'last4Digits', label: 'Last 4 digits of card', placeholder: '1234', type: 'text', inputMode: 'numeric', hint: 'Login requires SMS OTP — your phone will receive a code during import' },
    ],
  },
  {
    id: 'isracard',
    label: 'Isracard',
    icon: 'card',
    fields: [
      { key: 'id', label: 'National ID (ת.ז.)', placeholder: '123456789', type: 'text', inputMode: 'numeric' },
      { key: 'card6Digits', label: 'Last 6 digits of card', placeholder: '123456', type: 'text', inputMode: 'numeric', hint: 'The last 6 digits of your primary Isracard' },
      { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
    ],
  },
  {
    id: 'max',
    label: 'Max (Leumi Card)',
    icon: 'card',
    fields: [
      { key: 'username', label: 'Username', placeholder: 'Your Max username', type: 'text' },
      { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
    ],
  },
  {
    id: 'amex',
    label: 'Amex Israel',
    icon: 'card',
    fields: [
      { key: 'id', label: 'National ID (ת.ז.)', placeholder: '123456789', type: 'text', inputMode: 'numeric' },
      { key: 'card6Digits', label: 'Last 6 digits of card', placeholder: '123456', type: 'text', inputMode: 'numeric' },
      { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
    ],
  },
  {
    id: 'hapoalim',
    label: 'Bank Hapoalim',
    icon: 'bank',
    fields: [
      { key: 'userCode', label: 'User Code', placeholder: 'Your user code', type: 'text' },
      { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
    ],
  },
  {
    id: 'leumi',
    label: 'Bank Leumi',
    icon: 'bank',
    fields: [
      { key: 'username', label: 'Username', placeholder: 'Your username', type: 'text' },
      { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
    ],
  },
];

type Step = 'select' | 'credentials' | 'testing' | 'success' | 'error';

export default function AddBankAccountModal({ onClose, onAdded }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState('');

  const handleSelectProvider = (p: Provider) => {
    setSelectedProvider(p);
    setDisplayName(p.label);
    setCreds({});
    setStep('credentials');
  };

  const handleSave = async () => {
    if (!selectedProvider) return;
    setStep('testing');
    try {
      await addConnection(selectedProvider.id, creds, displayName);
      setStep('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save connection');
      setStep('error');
    }
  };

  const allFieldsFilled = selectedProvider?.fields.every((f) => creds[f.key]?.trim());

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {step === 'select' ? 'Add Bank Account' : selectedProvider?.label ?? 'Add Account'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {/* Provider selection */}
          {step === 'select' && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Choose the bank or credit card to connect:
              </p>
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProvider(p)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left"
                >
                  {p.icon === 'bank'
                    ? <Building2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    : <CreditCard className="w-5 h-5 text-purple-600 flex-shrink-0" />
                  }
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{p.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Credential form */}
          {step === 'credentials' && selectedProvider && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Display name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                />
              </div>

              {selectedProvider.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    inputMode={field.inputMode}
                    placeholder={field.placeholder}
                    value={creds[field.key] ?? ''}
                    onChange={(e) => setCreds((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    autoComplete="off"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                  />
                  {field.hint && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{field.hint}</p>
                  )}
                </div>
              ))}

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Credentials are encrypted end-to-end — Ooga never stores them in plaintext.
              </p>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setStep('select')}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={!allFieldsFilled || !displayName.trim()}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                >
                  Test & Save
                </button>
              </div>
            </div>
          )}

          {/* Testing */}
          {step === 'testing' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <div className="text-center">
                <p className="font-medium text-gray-900 dark:text-white">Testing connection…</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Verifying credentials with {selectedProvider?.label}</p>
              </div>
            </div>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <div className="text-center">
                <p className="font-semibold text-gray-900 dark:text-white">Connected!</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <strong>{displayName}</strong> was saved and verified.
                </p>
              </div>
              <button
                onClick={() => { onAdded?.(); onClose(); }}
                className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <AlertCircle className="w-12 h-12 text-red-500" />
              <div className="text-center">
                <p className="font-semibold text-gray-900 dark:text-white">Connection failed</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">{errorMsg}</p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => setStep('credentials')}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
