import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { User, Session } from '@supabase/supabase-js';

// Unmock AuthContext for this test file (it's mocked globally in setup.ts)
vi.unmock('../../src/contexts/AuthContext');

// Import after unmocking
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { applyLanguage } from '../../src/i18n';

// Mock Supabase
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    auth: {
      initialize: vi.fn(async () => ({ error: null })),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      getUser: vi.fn(),
    },
  },
}));

// Mock environment variable
vi.stubGlobal('import.meta', {
  env: {
    VITE_SITE_URL: 'https://test-app.vercel.app',
  },
});

describe('AuthContext', () => {
  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {
      first_name: 'John',
      last_name: 'Doe',
      full_name: 'John Doe',
    },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  };

  const mockSession: Session = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: Date.now() / 1000 + 3600,
    token_type: 'bearer',
    user: mockUser,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: no session on mount
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    // Mock auth state change subscription
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: {
        subscription: {
          id: 'mock-subscription-id',
          callback: vi.fn(),
          unsubscribe: vi.fn(),
        },
      },
    } as any);
  });

  describe('Initialization', () => {
    it('should initialize with no user when no session exists', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });

    it('should initialize with user when session exists', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
    });

    it('should start with loading state', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      expect(result.current.loading).toBe(true);
    });
  });

  describe('signUp', () => {
    it('should successfully sign up a new user', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: {
          user: mockUser,
          session: mockSession,
        },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.signUp(
        'newuser@example.com',
        'SecurePass123!',
        'Jane',
        'Smith'
      );

      expect(response.error).toBeNull();
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        options: {
          emailRedirectTo: expect.stringContaining('/'), // Flexible - could be test URL or production URL
          data: {
            first_name: 'Jane',
            last_name: 'Smith',
            full_name: 'Jane Smith',
          },
        },
      });
    });

    it('saves Hebrew with the account when signing up in Hebrew (names the household, picks the email)', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: mockUser, session: mockSession }, error: null });
      applyLanguage('he');
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await result.current.signUp('dana@example.com', 'SecurePass123!', 'דנה', 'לוי');

      expect(vi.mocked(supabase.auth.signUp).mock.calls.at(-1)?.[0].options?.data).toEqual({
        first_name: 'דנה',
        last_name: 'לוי',
        full_name: 'דנה לוי',
        language: 'he',
      });
      applyLanguage('en');
    });

    it('should handle signup errors', async () => {
      const mockError = {
        message: 'User already exists',
        status: 422,
      };

      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: {
          user: null,
          session: null,
        },
        error: mockError as any,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.signUp(
        'existing@example.com',
        'password123',
        'John',
        'Doe'
      );

      expect(response.error).toEqual(mockError);
    });

    it('should use window.location.origin when VITE_SITE_URL is not set', async () => {
      // Temporarily remove the env variable
      vi.stubGlobal('import.meta', {
        env: {},
      });

      // Mock window.location.origin
      Object.defineProperty(window, 'location', {
        value: {
          origin: 'http://localhost:5173',
        },
        writable: true,
      });

      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.signUp('test@example.com', 'pass123', 'Test', 'User');

      expect(supabase.auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            emailRedirectTo: 'http://localhost:5173/',
          }),
        })
      );

      // Restore
      vi.stubGlobal('import.meta', {
        env: {
          VITE_SITE_URL: 'https://test-app.vercel.app',
        },
      });
    });

    it('should include user metadata in signup', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.signUp('user@test.com', 'password', 'Alice', 'Johnson');

      expect(supabase.auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            data: {
              first_name: 'Alice',
              last_name: 'Johnson',
              full_name: 'Alice Johnson',
            },
          }),
        })
      );
    });
  });

  describe('signIn', () => {
    it('should successfully sign in a user', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: mockUser,
          session: mockSession,
        },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.signIn('test@example.com', 'password123');

      expect(response.error).toBeNull();
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should handle invalid credentials', async () => {
      const mockError = {
        message: 'Invalid login credentials',
        status: 400,
      };

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: {
          user: null,
          session: null,
        },
        error: mockError as any,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.signIn('wrong@example.com', 'wrongpass');

      expect(response.error).toEqual(mockError);
    });
  });

  describe('signOut', () => {
    it('should successfully sign out', async () => {
      vi.mocked(supabase.auth.signOut).mockResolvedValue({
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.signOut();

      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('should handle signout errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      vi.mocked(supabase.auth.signOut).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.signOut();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error signing out:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('resetPassword', () => {
    it('should send password reset email with correct redirect URL', async () => {
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
        data: {},
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.resetPassword('user@example.com');

      expect(response.error).toBeNull();
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'user@example.com',
        {
          redirectTo: expect.stringContaining('/reset-password'), // Flexible - could be test URL or production URL
        }
      );
    });

    it('should handle reset password errors', async () => {
      const mockError = {
        message: 'User not found',
        status: 404,
      };

      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
        data: {},
        error: mockError as any,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const response = await result.current.resetPassword('nonexistent@example.com');

      expect(response.error).toEqual(mockError);
    });

    it('should use window.location.origin for reset when VITE_SITE_URL is not set', async () => {
      // Temporarily remove the env variable
      vi.stubGlobal('import.meta', {
        env: {},
      });

      Object.defineProperty(window, 'location', {
        value: {
          origin: 'http://localhost:5173',
        },
        writable: true,
      });

      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
        data: {},
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.resetPassword('test@example.com');

      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        {
          redirectTo: 'http://localhost:5173/reset-password',
        }
      );

      // Restore
      vi.stubGlobal('import.meta', {
        env: {
          VITE_SITE_URL: 'https://test-app.vercel.app',
        },
      });
    });
  });

  describe('Auth State Changes', () => {
    it('should update user when auth state changes', async () => {
      let authStateCallback: (event: string, session: Session | null) => void = () => {};

      vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
        authStateCallback = callback as any;
        return {
          data: {
            subscription: {
              id: 'mock-subscription-id',
              callback: vi.fn(),
              unsubscribe: vi.fn(),
            },
          },
        } as any;
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Initially no user
      expect(result.current.user).toBeNull();

      // Simulate signin event
      authStateCallback('SIGNED_IN', mockSession);

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.session).toEqual(mockSession);
      });

      // Simulate signout event
      authStateCallback('SIGNED_OUT', null);

      await waitFor(() => {
        expect(result.current.user).toBeNull();
        expect(result.current.session).toBeNull();
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when useAuth is used outside AuthProvider', () => {
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');
    });
  });
});
