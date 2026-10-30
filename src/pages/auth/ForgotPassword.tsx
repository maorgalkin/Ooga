import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Mail, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

const ForgotPassword: React.FC = () => {
  const { resetPassword } = useAuth();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await resetPassword(email.trim());
    setLoading(false);

    if (error) {
      console.error('Failed to send password reset email:', error);
      setError(t('auth.forgot.error'));
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{t('auth.forgot.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('auth.forgot.body')}</p>
        </div>

        {sent ? (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start" role="status">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 me-3 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800 dark:text-green-300">
              <Trans i18nKey="auth.forgot.sent" values={{ email: email.trim() }} components={{ strong: <strong /> }} />
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start" role="alert">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 me-3 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800 dark:text-red-300">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('auth.forgot.email')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="block w-full ps-10 pe-3 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder={t('auth.fields.emailPlaceholder')}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 me-2" />
                    {t('auth.forgot.submitting')}
                  </>
                ) : (
                  t('auth.forgot.submit')
                )}
              </button>
            </form>
          </>
        )}

        <div className="mt-6 text-center">
          <Link to="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
            {t('auth.forgot.back')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
