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

// Look up a Supabase auth user by email using the Admin REST API.
// Returns the user's id, or null if no account exists with that email.
export async function getUserByEmail(email: string): Promise<{ id: string } | null> {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY!,
      },
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { users?: { id: string }[] };
  return data.users?.[0] ?? null;
}
