import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tabletop/shared';
import { supabaseService } from './supabaseService.js';
import { HttpError } from './httpErrors.js';

export type CampaignRole = 'dm' | 'player';

// Returns the user's role on the given campaign, or null if no membership row
// exists. Throws HttpError(500) on a Supabase/backend failure — callers must
// NOT treat backend errors as "no membership" (which would mask outages as
// 404s and silently bypass permission checks).
export async function getCampaignRole(
  userId: string,
  campaignId: string,
  client: SupabaseClient<Database> = supabaseService,
): Promise<CampaignRole | null> {
  const { data, error } = await client
    .from('campaign_members')
    .select('role')
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('getCampaignRole: supabase error', error);
    throw new HttpError(500, 'database error');
  }
  return data?.role ?? null;
}
