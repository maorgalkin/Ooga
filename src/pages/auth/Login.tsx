import React, { useState } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { authErrorMessage } from '../../i18n/authErrors';
import { useAuth } from '../../contexts/AuthContext';
import { safeReturnPath } from '../../utils/returnPath';
import { Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { PublicLayout } from '../../components/info/PublicLayout';
import { HeroShowcase } from '../../components/info/HeroShowcase';
import { LandingSections } from '../../components/info/LandingSections';

const Login: React.FC = () => {
  const { signIn, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnPath = safeReturnPath((location.state as { from?: unknown } | null)?.from);

  // Already signed in: there's nothing to do here, so go where they were heading
  if (user && !authLoading) return <Navigate to={returnPath} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(authErrorMessage(error, t, 'auth.errors.signInFailed'));
      setLoading(false);
    } else {
      navigate(returnPath, { replace: true });
    }
  };

  return (
    <PublicLayout>
      <section>
        <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16 grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
              <Trans
                i18nKey="auth.signIn.heroTitle"
                components={{ highlight: <span className="bg-gradient-to-r from-purple-600 via-blue-600 to-green-600 bg-clip-text text-transparent" /> }}
              />
            </h1>
            <p className="mt-5 text-lg text-gray-600 dark:text-gray-300 max-w-xl">
              {t('auth.signIn.heroBody')}
            </p>
            <div className="mt-10 hidden sm:block pb-8">
              <HeroShowcase />
            </div>
          </div>

      <div className="max-w-md w-full mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('auth.signIn.title')}</h2>
          <p className="text-gray-600 dark:text-gray-300">{t('auth.signIn.subtitle')}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <AlertCircle className="h-5 w-5 text-red-600 me-3 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              {t('auth.fields.email')}
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
                className="block w-full ps-10 pe-3 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder={t('auth.fields.emailPlaceholder')}
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              {t('auth.fields.password')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="block w-full ps-10 pe-3 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder={t('auth.fields.passwordPlaceholder')}
              />
            </div>
          </div>

          {/* Forgot Password Link */}
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link
                to="/forgot-password"
                className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                {t('auth.signIn.forgot')}
              </Link>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5 me-2" />
                {t('auth.signIn.submitting')}
              </>
            ) : (
              t('auth.signIn.submit')
            )}
          </button>
        </form>

        {/* Create account link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('auth.signIn.noAccount')}{' '}
            <Link
              to="/register"
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              {t('auth.signIn.createAccount')}
            </Link>
          </p>
        </div>
      </div>
        </div>
      </section>

      <LandingSections />
    </PublicLayout>
  );
};

export default Login;
