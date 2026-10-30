import { vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeAll } from 'vitest';

// Mock user for authentication
const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  user_metadata: {
    name: 'Test User'
  }
};

// Mock AuthContext to always be logged in during tests
vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({
    user: mockUser,
    session: {
      access_token: 'mock-token',
      refresh_token: 'mock-refresh',
      expires_in: 3600,
      token_type: 'bearer',
      user: mockUser
    },
    loading: false,
    signIn: vi.fn().mockResolvedValue({ data: { user: mockUser, session: null }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: mockUser, session: null }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    resetPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
    updatePassword: vi.fn().mockResolvedValue({ error: null }),
  }),
}));

// Mock Supabase service to prevent real API calls
vi.mock('../services/supabase', () => ({
  SupabaseService: {
    getTransactions: vi.fn().mockResolvedValue([]),
    addTransaction: vi.fn().mockImplementation((txn) => Promise.resolve({ ...txn, id: Date.now().toString() })),
    updateTransaction: vi.fn().mockResolvedValue({}),
    deleteTransaction: vi.fn().mockResolvedValue(undefined),
    getFamilyMembers: vi.fn().mockResolvedValue([]),
    addFamilyMember: vi.fn().mockImplementation((member) => Promise.resolve({ ...member, id: Date.now().toString() })),
    updateFamilyMember: vi.fn().mockResolvedValue({}),
    deleteFamilyMember: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock ResizeObserver for chart tests
beforeAll(() => {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

// Mock window.alert for validation tests
Object.defineProperty(window, 'alert', {
  writable: true,
  value: vi.fn(),
});

// Mock console methods to reduce noise in tests
const consoleMock = {
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
};

Object.defineProperty(console, 'log', { value: consoleMock.log });
Object.defineProperty(console, 'error', { value: consoleMock.error });
Object.defineProperty(console, 'warn', { value: consoleMock.warn });
Object.defineProperty(console, 'info', { value: consoleMock.info });
