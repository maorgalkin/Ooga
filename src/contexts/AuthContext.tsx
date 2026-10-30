import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  /** Set a new password for the signed-in user (including the session a reset link opens). */
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>;
  /** True once Supabase reports PASSWORD_RECOVERY: this session was opened by a reset link. */
  isRecovery: boolean;
  /** The page loaded from a reset link and the PASSWORD_RECOVERY event hasn't arrived yet. */
  awaitingRecovery: boolean;
}

// supabase-js strips the hash once it has read the token, so look before it does. Only used to
// keep a spinner up until the event arrives, never to decide whether a reset is allowed.
const OPENED_FROM_RECOVERY_LINK =
  typeof window !== 'undefined' && new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type') === 'recovery';
// Safety cap only: the wait normally ends as soon as supabase-js finishes initialising
const RECOVERY_EVENT_MAX_WAIT_MS = 15000;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Tied to the user the reset link signed in, so a later session for someone else doesn't inherit it
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null);
  const [awaitingRecovery, setAwaitingRecovery] = useState(OPENED_FROM_RECOVERY_LINK);

  useEffect(() => {
    if (!awaitingRecovery) return;
    const timer = setTimeout(() => setAwaitingRecovery(false), RECOVERY_EVENT_MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, [awaitingRecovery]);

  useEffect(() => {
    let cancelled = false;
    // supabase-js queues PASSWORD_RECOVERY with setTimeout(0) before initialize() resolves, so a
    // timeout queued after it runs once the event has been delivered (or was never coming)
    supabase.auth.initialize().then(() => {
      setTimeout(() => { if (!cancelled) setAwaitingRecovery(false); }, 0);
    });

    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryUserId(session?.user.id ?? null);
        setAwaitingRecovery(false);
      }
      // Not on SIGNED_IN: supabase-js emits it when the tab regains focus, mid-reset
      if (event === 'SIGNED_OUT') {
        setRecoveryUserId(null);
        setAwaitingRecovery(false);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      // Use production URL for email redirects, fallback to current origin
      const redirectUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${redirectUrl}/`,
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`,
          },
        },
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      // Use production URL for email redirects, fallback to current origin
      const redirectUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${redirectUrl}/reset-password`,
      });
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const updatePassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (!error) {
        setRecoveryUserId(null);
        // A reset often follows a suspected compromise, so end every other session
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
        if (signOutError) console.error('Failed to sign out other sessions:', signOutError);
      }
      return { error };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    isRecovery: recoveryUserId !== null && recoveryUserId === user?.id,
    awaitingRecovery,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
