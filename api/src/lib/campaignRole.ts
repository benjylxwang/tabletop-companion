import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tabletop/shared';
import { supabaseService } from './supabaseService.js';

export type CampaignRole = 'dm' | 'player';

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
    return null;
  }
  return data?.role ?? null;
}
