import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var is required for e2e tests`);
  return value;
}

export function adminClient(): SupabaseClient {
  return createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function createConfirmedUser(
  admin: SupabaseClient,
): Promise<TestUser> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-${suffix}@example.test`;
  const password = 'e2e-password-123';

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: 'E2E Test DM' },
  });
  if (error || !data.user) {
    throw new Error(`Failed to create test user: ${error?.message ?? 'no user'}`);
  }

  return { id: data.user.id, email, password };
}

export async function deleteUser(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    // Don't fail teardown — surface as warning.
    console.warn(`Failed to delete test user ${userId}: ${error.message}`);
  }
}
