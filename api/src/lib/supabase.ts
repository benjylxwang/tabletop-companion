import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tabletop/shared';

// Anon client — used by authMiddleware to resolve a user from a Bearer token
// via `supabase.auth.getUser()`. Data access goes through the service-role
// client in supabaseService.ts (which bypasses RLS as documented in the
// initial migration).
const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase config: SUPABASE_URL and SUPABASE_ANON_KEY are required',
  );
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
