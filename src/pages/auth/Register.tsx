import React, { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { authErrorMessage } from '../../i18n/authErrors';
import { useAuth } from '../../contexts/AuthContext';
import { Mail, Lock, AlertCircle, Loader2, CheckCircle, User } from 'lucide-react';
import { PublicLayout } from '../../components/info/PublicLayout';
import { FloatingShapes } from '../../components/info/LandingSections';

const inputClass =
  'block w-full ps-10 pe-3 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2';
const MIN_PASSWORD_LENGTH = 6;
const cardClass =
  'max-w-md w-full mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8';

/** Same backdrop as the /login hero, so moving between the two pages feels like one place. */
function AuthBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800" />
      <FloatingShapes />
      <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">{children}</div>
    </section>
  );
}

const Register: React.FC = () => {
  const { signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Already signed in: they have an account, so take them to the app
  if (user && !authLoading) return <Navigate to="/" replace />;

  const validateForm = () => {
    if (!firstName.trim()) {
      setError(t('auth.register.errors.firstName'));
      return false;
    }
    if (!lastName.trim()) {
      setError(t('auth.register.errors.lastName'));
      return false;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('auth.register.errors.passwordLength', { count: MIN_PASSWORD_LENGTH }));
      return false;
    }
    if (password !== confirmPassword) {
      setError(t('auth.register.errors.mismatch'));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    const { error } = await signUp(email, password, firstName.trim(), lastName.trim());

    if (error) {
      setError(authErrorMessage(error, t, 'auth.errors.signUpFailed'));
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      // Auto-redirect after 3 seconds
      setTimeout(() => navigate('/'), 3000);
    }
  };

  if (success) {
    return (
      <PublicLayout>
        <AuthBackdrop>
          <div className={`${cardClass} text-center`}>
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 dark:bg-green-900/40 rounded-full p-3">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('auth.register.checkEmail.title')}</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              <Trans
                i18nKey="auth.register.checkEmail.body"
                values={{ email }}
                components={{ strong: <strong className="text-gray-900 dark:text-white" /> }}
              />
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('auth.register.checkEmail.hint')}</p>
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
              {t('auth.register.checkEmail.signIn')}
            </Link>
          </div>
        </AuthBackdrop>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <AuthBackdrop>
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="text-center lg:text-start">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
              <Trans
                i18nKey="auth.register.heroTitle"
                components={{ highlight: <span className="bg-gradient-to-r from-purple-600 via-blue-600 to-green-600 bg-clip-text text-transparent" /> }}
              />
            </h1>
            <p className="mt-5 text-lg text-gray-600 dark:text-gray-300 max-w-xl mx-auto lg:mx-0">
              {t('auth.register.heroBody')}
            </p>
          </div>

          <div className={cardClass}>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('auth.register.title')}</h2>
              <p className="text-gray-600 dark:text-gray-300">{t('auth.register.subtitle')}</p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start"
              >
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 me-3 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800 dark:text-red-200">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className={labelClass}>
                    {t('auth.register.firstName')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="firstName"
                      type="text"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      disabled={loading}
                      className={inputClass}
                      placeholder={t('auth.register.firstNamePlaceholder')}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="lastName" className={labelClass}>
                    {t('auth.register.lastName')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="lastName"
                      type="text"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      disabled={loading}
                      className={inputClass}
                      placeholder={t('auth.register.lastNamePlaceholder')}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="email" className={labelClass}>
                  {t('auth.fields.email')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className={inputClass}
                    placeholder={t('auth.fields.emailPlaceholder')}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className={labelClass}>
                  {t('auth.fields.password')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    aria-describedby="password-help"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className={inputClass}
                  />
                </div>
                <p id="password-help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('auth.register.passwordHelp', { count: MIN_PASSWORD_LENGTH })}
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className={labelClass}>
                  {t('auth.register.confirmPassword')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className={inputClass}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:bg-blue-400 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 me-2" />
                    {t('auth.register.submitting')}
                  </>
                ) : (
                  t('auth.register.submit')
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t('auth.register.haveAccount')}{' '}
                <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
                  {t('auth.register.signIn')}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </AuthBackdrop>
    </PublicLayout>
  );
};

export default Register;
