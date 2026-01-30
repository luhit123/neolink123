import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey &&
    supabaseUrl !== 'https://your-project-ref.supabase.co' &&
    supabaseAnonKey !== 'your_supabase_anon_key_here');
};

// Create Supabase client with type safety
export const supabase = createClient<Database>(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

// Helper to check if Supabase operations should be attempted
export const shouldSyncToSupabase = (): boolean => {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase is not configured. Skipping sync.');
    return false;
  }
  return true;
};
