import { createClient } from '@supabase/supabase-js';
import type { Database } from '@tabletop/shared';
import { ConfigResponse } from '@tabletop/shared';

const apiBase = import.meta.env.VITE_API_URL ?? '';

// Fetch public Supabase config from the API at boot. Using top-level await so
// every downstream `supabase` import resolves against a fully-initialised
// client — we keep the URL/anon key out of the frontend build entirely.
const res = await fetch(`${apiBase}/config`);
if (!res.ok) {
  throw new Error(`Failed to load config from API (${res.status})`);
}
const config = ConfigResponse.parse(await res.json());

export const supabase = createClient<Database>(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
