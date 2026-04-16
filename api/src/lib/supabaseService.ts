import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tabletop/shared';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing Supabase config: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
  );
}

export const supabaseService: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
