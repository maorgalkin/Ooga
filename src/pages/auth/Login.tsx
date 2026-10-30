import React, { useState } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { safeReturnPath } from '../../utils/returnPath';
import { Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { PublicLayout } from '../../components/info/PublicLayout';
import { HeroShowcase } from '../../components/info/HeroShowcase';
import { FloatingShapes, LandingSections } from '../../components/info/LandingSections';

const Login: React.FC = () => {
  const { signIn, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
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
      setError(error.message);
      setLoading(false);
    } else {
      navigate(returnPath, { replace: true });
    }
  };

  return (
    <PublicLayout>
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-purple-50 via-blue-50 to-green-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800" />
        <FloatingShapes />
        <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16 grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
              Your family's money,{' '}
              <span className="bg-gradient-to-r from-purple-600 via-blue-600 to-green-600 bg-clip-text text-transparent">finally clear</span>
            </h1>
            <p className="mt-5 text-lg text-gray-600 dark:text-gray-300 max-w-xl">
              Ooga brings everyone's spending into one budget, so you know where the money goes and stay in control of the
              bottom line every month.
            </p>
            <div className="mt-10 hidden sm:block pb-8">
              <HeroShowcase />
            </div>
          </div>

      <div className="max-w-md w-full mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome back</h2>
          <p className="text-gray-600 dark:text-gray-300">Sign in to your Ooga account</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <AlertCircle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="you@example.com"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Enter your password"
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
                Forgot your password?
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
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {/* Create account link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              Create account
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
