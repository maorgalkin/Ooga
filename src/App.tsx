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
import { DevTools } from './pages/DevTools';
import { Plus, LogOut, Loader2 } from 'lucide-react';
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
        {/* Diagonal color sections - clean cuts between colors */}
        <div className="absolute inset-0">
          {/* Purple section (left) */}
          <div 
            className="absolute inset-0 bg-purple-600/90"
            style={{
              clipPath: 'polygon(0 0, 35% 0, 25% 100%, 0 100%)'
            }}
          ></div>
          {/* Blue section (middle) */}
          <div 
            className="absolute inset-0 bg-blue-600/90"
            style={{
              clipPath: 'polygon(25% 0, 70% 0, 60% 100%, 15% 100%)'
            }}
          ></div>
          {/* Green section (right) */}
          <div 
            className="absolute inset-0 bg-green-600/90"
            style={{
              clipPath: 'polygon(60% 0, 100% 0, 100% 100%, 50% 100%)'
            }}
          ></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 relative z-10">
          <div className="h-16 flex items-center justify-between">
            {/* Logo in hexagon */}
            <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity group">
              {/* Hexagon container for logo */}
              <div className="relative">
                <svg width="50" height="58" viewBox="0 0 50 58" className="drop-shadow-lg">
                  {/* Hexagon shape */}
                  <path 
                    d="M25 0 L50 14.5 L50 43.5 L25 58 L0 43.5 L0 14.5 Z" 
                    fill="rgba(255, 255, 255, 0.25)"
                    stroke="rgba(255, 255, 255, 0.5)"
                    strokeWidth="2"
                    className="group-hover:fill-white/30 transition-all"
                  />
                  {/* Letter G in the center */}
                  <text 
                    x="25" 
                    y="38" 
                    textAnchor="middle" 
                    fill="white" 
                    fontSize="28" 
                    fontWeight="bold"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    G
                  </text>
                </svg>
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-bold text-white drop-shadow-md leading-tight">Ooga</h1>
                <span className="hidden sm:inline text-xs text-white/90 drop-shadow leading-tight">Take the Cake</span>
              </div>
              {user && (
                <span className="hidden md:inline ml-2 text-xs text-white/70 drop-shadow">
                  {user.email}
                </span>
              )}
            </Link>
            
            {/* Desktop & Mobile Buttons - Glassy style */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <button
                onClick={() => setIsAddTransactionOpen(true)}
                className="flex items-center justify-center px-3 py-2 bg-white/20 backdrop-blur-md text-white rounded-lg hover:bg-white/30 transition-all border border-white/40 text-sm font-medium min-h-[38px] shadow-lg hover:shadow-xl hover:scale-105"
              >
                <Plus className="h-4 w-4 flex-shrink-0" />
                <span className="ml-2 max-md:hidden">Add Transaction</span>
              </button>
              <button
                onClick={signOut}
                className="flex items-center justify-center px-3 py-2 bg-red-500/30 backdrop-blur-md text-white rounded-lg hover:bg-red-500/40 transition-all border border-red-400/50 text-sm font-medium min-h-[38px] shadow-lg hover:shadow-xl hover:scale-105"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                <span className="ml-2 max-md:hidden">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dev-tools" element={<DevTools />} />
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
