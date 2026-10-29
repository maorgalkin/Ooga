import { createClient } from '@supabase/supabase-js';

// Supabase configuration
// These values come from your Supabase project settings
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.\n' +
    'Required variables:\n' +
    '  - VITE_SUPABASE_URL\n' +
    '  - VITE_SUPABASE_ANON_KEY\n\n' +
    'See docs/SUPABASE_BRINGUP.md for setup instructions.'
  );
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage, // Use localStorage for session persistence
  },
});

// Database type definitions for TypeScript
// Note: These are simplified types. The actual schema is managed via Supabase migrations.
// See /supabase/migrations for the full schema.
export interface Database {
  public: {
    Tables: {
      family_members: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['family_members']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['family_members']['Insert']>;
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          family_member_id: string | null;
          date: string;
          description: string;
          amount: number;
          category: string;
          type: 'income' | 'expense';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
      };
    };
  };
}

// Helper type for authenticated user
export type AuthUser = {
  id: string;
  email: string;
  created_at: string;
};

// Export typed supabase client
export type SupabaseClient = typeof supabase;
