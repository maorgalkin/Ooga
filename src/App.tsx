import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FinanceProvider } from './context/FinanceContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Dashboard from './components/Dashboard';
import AddTransaction from './components/AddTransaction';
import { BuildInfo } from './components/BuildInfo';
import { BackToTop } from './components/BackToTop';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import { BrandBackdrop, BrandLogo } from './components/info/BrandBar';
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const { signOut, user } = useAuth();

  // Allow any child component (e.g. DashboardEmptyState) to open the modal
  useEffect(() => {
    const handler = () => setIsAddTransactionOpen(true);
    window.addEventListener('open-add-transaction', handler);
    return () => window.removeEventListener('open-add-transaction', handler);
  }, []);

  return (
    <div className="min-h-screen dark:bg-gray-900 transition-colors duration-500">
      <nav className="relative overflow-hidden shadow-md border-b border-gray-200/20">
        <BrandBackdrop />

        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 relative z-10">
          <div className="h-16 flex items-center justify-between">
            <BrandLogo>
              {user && (
                <span className="hidden md:inline ml-2 text-xs text-white/70 drop-shadow">
                  {user.email}
                </span>
              )}
            </BrandLogo>
            
            {/* Desktop & Mobile Buttons - Glassy style */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Link
                to="/guide"
                className="flex items-center justify-center px-3 py-2 bg-white/20 backdrop-blur-md text-white rounded-lg hover:bg-white/30 transition-all border border-white/40 text-sm font-medium min-h-[38px] shadow-lg hover:shadow-xl hover:scale-105"
              >
                <CircleHelp className="h-4 w-4 flex-shrink-0" />
                <span className="ml-2 max-md:sr-only">Help</span>
              </Link>
              <button
                onClick={() => setIsAddTransactionOpen(true)}
                className="flex items-center justify-center px-3 py-2 bg-white/20 backdrop-blur-md text-white rounded-lg hover:bg-white/30 transition-all border border-white/40 text-sm font-medium min-h-[38px] shadow-lg hover:shadow-xl hover:scale-105"
              >
                <Plus className="h-4 w-4 flex-shrink-0" />
                <span className="ml-2 max-md:hidden">Add transaction</span>
              </button>
              <button
                onClick={signOut}
                className="flex items-center justify-center px-3 py-2 bg-red-500/30 backdrop-blur-md text-white rounded-lg hover:bg-red-500/40 transition-all border border-red-400/50 text-sm font-medium min-h-[38px] shadow-lg hover:shadow-xl hover:scale-105"
                title="Sign out"
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                <span className="ml-2 max-md:hidden">Sign out</span>
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
        <BrowserRouter>
          <FinanceProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
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
