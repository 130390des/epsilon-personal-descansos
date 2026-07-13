import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export function ensureSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase no esta configurado. Agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.',
    );
  }

  return supabase;
}
