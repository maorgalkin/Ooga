import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Lock, AlertCircle, Loader2 } from 'lucide-react';

const MIN_PASSWORD_LENGTH = 6;

/**
 * Landing page for the link in the password reset email. The form shows only for a session
 * the link opened (Supabase's PASSWORD_RECOVERY event), not for anyone already signed in.
 */
const ResetPassword: React.FC = () => {
  const { user, loading: authLoading, updatePassword, isRecovery, awaitingRecovery } = useAuth();
  const navigate = useNavigate();
  // Supabase sends an expired or used link back with error_code in the hash; checking it
  // catches those links whatever the session state
  const { hash } = useLocation();
  const linkFailed = new URLSearchParams(hash.replace(/^#/, '')).has('error_code');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords don't match.");
      return;
    }

    setSaving(true);
    const { error } = await updatePassword(password);
    setSaving(false);

    if (error) {
      console.error('Failed to update password:', error);
      setError("Couldn't save your new password. Try again, or request a new reset link.");
    } else {
      navigate('/', { replace: true });
    }
  };

  const inputClass =
    'block w-full ps-10 pe-3 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Choose a new password</h1>
        </div>

        {authLoading || awaitingRecovery ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        ) : !user || linkFailed || !isRecovery ? (
          <div className="text-center space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              This reset link has expired or was already used. Request a new one to continue.
            </p>
            <Link
              to="/forgot-password"
              className="inline-block py-2 px-4 rounded-lg text-white bg-blue-600 hover:bg-blue-700 font-medium transition-colors"
            >
              Request a new link
            </Link>
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
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={saving}
                    className={inputClass}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">At least {MIN_PASSWORD_LENGTH} characters</p>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm new password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={saving}
                    className={inputClass}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 me-2" />
                    Saving…
                  </>
                ) : (
                  'Save new password'
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
