import { useState } from 'react';
import { Trans } from 'react-i18next';
import i18n from '../i18n';
import { useT } from '../hooks/useT';
import { X, Building2, CreditCard, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { addConnection } from '../services/bankImportService';
import { addSecureConnection } from '../services/scraperService';

// Cal fast access is imported straight from the browser; it only needs the (non-secret) ID and
// last 4 card digits to request the SMS code. Every other provider logs in on the import service,
// which stores the credentials encrypted and never returns them.
const BROWSER_IMPORT_PROVIDERS = new Set(['visaCalFast']);

interface Props {
  onClose: () => void;
  onAdded?: () => void;
}

type Provider = {
  id: string;
  label: string;
  icon: 'bank' | 'card';
  fields: CredentialField[];
  /** Imports work end to end. The rest stay listed as "Coming soon" so people can see what's planned. */
  available?: boolean;
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
    available: true,
    fields: [
      { key: 'id', label: 'National ID (ת.ז.)', placeholder: '123456789', type: 'text', inputMode: 'numeric' },
      { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
      { key: 'num', label: 'Access code (קוד גישה)', placeholder: '6-character code', type: 'text', hint: 'The code shown on the bank\'s sign-in page, not the SMS code' },
    ],
  },
  {
    id: 'visaCal',
    label: 'Visa Cal (username)',
    icon: 'card',
    fields: [
      { key: 'username', label: 'Username', placeholder: 'Your Cal username', type: 'text' },
      { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
    ],
  },
  {
    id: 'visaCalFast',
    label: 'Visa Cal (SMS code)',
    icon: 'card',
    available: true,
    fields: [
      { key: 'id', label: 'National ID (ת.ז.)', placeholder: '123456789', type: 'text', inputMode: 'numeric' },
      { key: 'last4Digits', label: 'Last 4 digits of card', placeholder: '1234', type: 'text', inputMode: 'numeric', hint: 'Signing in needs an SMS code. Your phone gets one during import.' },
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
      { key: 'userCode', label: 'User code', placeholder: 'Your user code', type: 'text' },
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
  const t = useT();
  const [step, setStep] = useState<Step>('select');

  // PROVIDERS holds the English; the reader's language comes from import.providerNames and import.fields
  const providerName = (p: Provider) => t(`import.providerNames.${p.id}`, { defaultValue: p.label });
  const fieldText = (providerId: string, field: CredentialField, part: 'label' | 'placeholder' | 'hint') => {
    const own = `import.fieldsByProvider.${providerId}.${field.key}.${part}`;
    const shared = `import.fields.${field.key}.${part}`;
    if (i18n.exists(own)) return t(own);
    if (i18n.exists(shared)) return t(shared);
    return field[part];
  };
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState('');

  const handleSelectProvider = (p: Provider) => {
    setSelectedProvider(p);
    setDisplayName(providerName(p));
    setFieldValues({});
    setStep('credentials');
  };

  const handleSave = async () => {
    if (!selectedProvider) return;
    setStep('testing');
    try {
      if (BROWSER_IMPORT_PROVIDERS.has(selectedProvider.id)) {
        await addConnection(selectedProvider.id, fieldValues, displayName);
      } else {
        await addSecureConnection(selectedProvider.id, fieldValues, displayName);
      }
      setStep('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('import.addAccount.saveFailed'));
      setStep('error');
    }
  };

  const allFieldsFilled = selectedProvider?.fields.every((f) => fieldValues[f.key]?.trim());

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {step === 'select' ? t('import.addAccount.title') : selectedProvider ? providerName(selectedProvider) : t('transactions.form.addAccount')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
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
                {t('import.addAccount.choose')}
              </p>
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProvider(p)}
                  disabled={!p.available}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 enabled:hover:border-blue-400 enabled:hover:bg-blue-50 dark:enabled:hover:bg-blue-900/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-start"
                >
                  {p.icon === 'bank'
                    ? <Building2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    : <CreditCard className="w-5 h-5 text-purple-600 flex-shrink-0" />
                  }
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{providerName(p)}</span>
                  {!p.available && (
                    <span className="ms-auto text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5">
                      {t('import.addAccount.comingSoon')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Credential form */}
          {step === 'credentials' && selectedProvider && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('import.addAccount.displayName')}
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
                    {fieldText(selectedProvider.id, field, 'label')}
                  </label>
                  <input
                    type={field.type}
                    inputMode={field.inputMode}
                    placeholder={fieldText(selectedProvider.id, field, 'placeholder')}
                    value={fieldValues[field.key] ?? ''}
                    onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    autoComplete="off"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                  />
                  {field.hint && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{fieldText(selectedProvider.id, field, 'hint')}</p>
                  )}
                </div>
              ))}

              <p className="text-xs text-gray-500 dark:text-gray-400">
                {BROWSER_IMPORT_PROVIDERS.has(selectedProvider.id)
                  ? t('import.addAccount.cardNote')
                  : t('import.addAccount.serverNote')}
              </p>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setStep('select')}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('import.addAccount.back')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={!allFieldsFilled || !displayName.trim()}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                >
                  {t('import.addAccount.testSave')}
                </button>
              </div>
            </div>
          )}

          {/* Testing */}
          {step === 'testing' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <div className="text-center">
                <p className="font-medium text-gray-900 dark:text-white">{t('import.addAccount.testing')}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('import.addAccount.verifying', { provider: selectedProvider ? providerName(selectedProvider) : '' })}</p>
              </div>
            </div>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <div className="text-center">
                <p className="font-semibold text-gray-900 dark:text-white">{t('import.addAccount.connected')}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <Trans i18nKey="import.addAccount.savedVerified" values={{ name: displayName }} components={{ b: <strong dir="auto" /> }} />
                </p>
              </div>
              <button
                onClick={() => { onAdded?.(); onClose(); }}
                className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                {t('import.done')}
              </button>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <AlertCircle className="w-12 h-12 text-red-500" />
              <div className="text-center">
                <p className="font-semibold text-gray-900 dark:text-white">{t('import.addAccount.failed')}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">{errorMsg}</p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('common.close')}
                </button>
                <button
                  onClick={() => setStep('credentials')}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                >
                  {t('import.tryAgain')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
