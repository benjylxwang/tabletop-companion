import { Router } from 'express';
import {
  CampaignInvitationsResponse,
  CampaignInvitationWithCampaign,
  CampaignStatusEnum,
} from '@tabletop/shared';
import { supabaseService } from '../lib/supabaseService.js';
import {
  HttpError,
  NotFoundError,
  sendError,
} from '../lib/httpErrors.js';

export const invitationsRouter = Router();

// ─── GET /invitations ─────────────────────────────────────────────────────────
// Returns all pending invitations for the authenticated user, with campaign
// details included so the invitee knows what they're being invited to.

invitationsRouter.get('/invitations', async (req, res) => {
  try {
    const userId = req.user!.id;

    const { data, error } = await supabaseService
      .from('campaign_invitations')
      .select('*, campaigns(name, system, status)')
      .eq('invited_user_id', userId)
      .eq('status', 'pending');

    if (error) throw new HttpError(500, 'database error');

    const invitations = (data ?? []).map((row) => {
      const campaign = row.campaigns as { name: string; system: string | null; status: string } | null;
      return CampaignInvitationWithCampaign.parse({
        id: row.id,
        campaign_id: row.campaign_id,
        invited_user_id: row.invited_user_id,
        invited_by_user_id: row.invited_by_user_id,
        status: row.status,
        created_at: row.created_at,
        campaign_name: campaign?.name ?? 'Unknown Campaign',
        campaign_system: campaign?.system ?? undefined,
        campaign_status: CampaignStatusEnum.parse(campaign?.status ?? 'Active'),
      });
    });

    res.json(CampaignInvitationsResponse.parse({ invitations }));
  } catch (err) {
    sendError(res, err);
  }
});

// ─── POST /invitations/:id/accept ────────────────────────────────────────────
// Accept a pending invitation: creates a campaign_members row, then marks
// the invitation as accepted.

invitationsRouter.post('/invitations/:id/accept', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { data: inv, error: fetchError } = await supabaseService
      .from('campaign_invitations')
      .select('*')
      .eq('id', id)
      .eq('invited_user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    if (fetchError) throw new HttpError(500, 'database error');
    if (!inv) throw new NotFoundError();

    // Guard against race: only insert member if not already present
    const { data: existingMember } = await supabaseService
      .from('campaign_members')
      .select('user_id')
      .eq('campaign_id', inv.campaign_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingMember) {
      const { error: memberError } = await supabaseService
        .from('campaign_members')
        .insert({ campaign_id: inv.campaign_id, user_id: userId, role: 'player' });

      if (memberError) throw new HttpError(500, 'database error');
    }

    const { error: updateError } = await supabaseService
      .from('campaign_invitations')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw new HttpError(500, 'database error');

    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});

// ─── POST /invitations/:id/decline ───────────────────────────────────────────
// Decline a pending invitation — the campaign disappears from the invitee's
// list.

invitationsRouter.post('/invitations/:id/decline', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { data: inv, error: fetchError } = await supabaseService
      .from('campaign_invitations')
      .select('id')
      .eq('id', id)
      .eq('invited_user_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    if (fetchError) throw new HttpError(500, 'database error');
    if (!inv) throw new NotFoundError();

    const { error: updateError } = await supabaseService
      .from('campaign_invitations')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw new HttpError(500, 'database error');

    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});
