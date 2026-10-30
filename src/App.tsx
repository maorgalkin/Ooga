import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FinanceProvider } from './context/FinanceContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageSync } from './i18n/LanguageSync';
import { HebrewOffer } from './i18n/HebrewOffer';
import { useTranslation } from 'react-i18next';
import { useT } from './hooks/useT';
import Dashboard from './components/Dashboard';
import AddTransaction from './components/AddTransaction';
import { BuildInfo } from './components/BuildInfo';
import { BackToTop } from './components/BackToTop';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import { BrandBackdrop, BrandLogo } from './components/info/BrandBar';
import { GlossyBackdrop } from './components/info/GlossyBackdrop';
import AboutPage from './pages/info/AboutPage';
import GuidePage from './pages/info/GuidePage';
import { Plus, LogOut, Loader2, CircleHelp } from 'lucide-react';
import './App.css';

// Create a React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Protected Route Component - requires authentication
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="relative isolate min-h-screen flex items-center justify-center">
        <GlossyBackdrop />
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Remember where they were heading, so a link from the guide lands there after sign-in
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}

function AppContent() {
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const { signOut } = useAuth();
  const t = useT();

  // Allow any child component (e.g. DashboardEmptyState) to open the modal
  useEffect(() => {
    const handler = () => setIsAddTransactionOpen(true);
    window.addEventListener('open-add-transaction', handler);
    return () => window.removeEventListener('open-add-transaction', handler);
  }, []);

  return (
    <div className="relative isolate min-h-screen">
      <GlossyBackdrop />
      <nav className="relative overflow-hidden shadow-md border-b border-gray-200/20">
        <BrandBackdrop />

        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 relative z-10">
          <div className="h-16 flex items-center justify-between">
            <BrandLogo />
            
            {/* Desktop & Mobile Buttons - Glassy style */}
            <div className="flex items-center space-x-2 rtl:space-x-reverse sm:space-x-3">
              <button
                onClick={() => setIsAddTransactionOpen(true)}
                className="flex items-center justify-center px-3 py-2 bg-white/20 backdrop-blur-md text-white rounded-lg hover:bg-white/30 transition-all border border-white/40 text-sm font-medium min-h-[38px] shadow-lg hover:shadow-xl hover:scale-105"
              >
                <Plus className="h-4 w-4 flex-shrink-0" />
                <span className="ms-2 max-md:sr-only">{t('nav.addTransaction')}</span>
              </button>
              <Link
                to="/guide"
                className="flex items-center justify-center px-3 py-2 bg-white/20 backdrop-blur-md text-white rounded-lg hover:bg-white/30 transition-all border border-white/40 text-sm font-medium min-h-[38px] shadow-lg hover:shadow-xl hover:scale-105"
              >
                <CircleHelp className="h-4 w-4 flex-shrink-0" />
                <span className="ms-2 max-md:sr-only">{t('nav.help')}</span>
              </Link>
              <button
                onClick={signOut}
                className="flex items-center justify-center px-3 py-2 bg-red-500/30 backdrop-blur-md text-white rounded-lg hover:bg-red-500/40 transition-all border border-red-400/50 text-sm font-medium min-h-[38px] shadow-lg hover:shadow-xl hover:scale-105"
                title={t('nav.signOut')}
              >
                <LogOut className="h-4 w-4 flex-shrink-0 rtl:-scale-x-100" />
                <span className="ms-2 max-md:hidden">{t('nav.signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </main>
      <AddTransaction
        isOpen={isAddTransactionOpen}
        onClose={() => setIsAddTransactionOpen(false)}
      />
      {/* DEV: Floating BuildInfo with click-to-top. PROD: BackToTop button only */}
      {import.meta.env.DEV ? (
        <BuildInfo />
      ) : (
        <BackToTop />
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageSync />
        <HebrewOffer />
        <BrowserRouter>
          <FinanceProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              {/* Public: the reset email's link signs the person in on arrival */}
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/guide" element={<GuidePage />} />
              <Route path="/guide/:chapter" element={<GuidePage />} />
              
              {/* Protected routes */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppContent />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </FinanceProvider>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
