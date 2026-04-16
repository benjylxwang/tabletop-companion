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

// Look up a user by email via the profiles table (a public mirror of auth.users
// populated by a trigger on sign-up). The service role bypasses RLS so this
// returns any registered user's id, or null if no account exists with that email.
export async function getUserByEmail(email: string): Promise<{ id: string } | null> {
  const { data } = await supabaseService
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  return data ?? null;
}

// Invite a new user by email via Supabase Auth. Creates the auth.users row
// immediately (which triggers handle_new_user → profiles insert) and sends
// the invitee an email with a sign-up link. Returns the new user's UUID.
export async function sendSignupInvite(email: string): Promise<{ id: string } | null> {
  const { data, error } = await supabaseService.auth.admin.inviteUserByEmail(email);
  if (error || !data.user) return null;
  return { id: data.user.id };
}
