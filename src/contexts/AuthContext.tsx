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
const RECOVERY_EVENT_WAIT_MS = 3000;

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
  const [isRecovery, setIsRecovery] = useState(false);
  const [awaitingRecovery, setAwaitingRecovery] = useState(OPENED_FROM_RECOVERY_LINK);

  useEffect(() => {
    if (!awaitingRecovery) return;
    const timer = setTimeout(() => setAwaitingRecovery(false), RECOVERY_EVENT_WAIT_MS);
    return () => clearTimeout(timer);
  }, [awaitingRecovery]);

  useEffect(() => {
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
        setIsRecovery(true);
        setAwaitingRecovery(false);
      }
      if (event === 'SIGNED_OUT') {
        setIsRecovery(false);
        setAwaitingRecovery(false);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
        setIsRecovery(false);
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
    isRecovery,
    awaitingRecovery,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
