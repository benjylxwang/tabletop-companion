import { createClient } from '@supabase/supabase-js';
import type { Database } from '@tabletop/shared';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loud in the browser console so misconfigured deployments are obvious.
  // Returning a stub would silently break auth and every authed API call.
  throw new Error(
    'Missing Supabase config: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required',
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
