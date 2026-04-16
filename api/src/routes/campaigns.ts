import { Router } from 'express';
import { z } from 'zod';
import {
  CampaignCreate,
  CampaignUpdate,
  CampaignWithRole,
  CampaignsResponse,
  CampaignResponse,
  CampaignMember,
  CampaignMembersResponse,
  CampaignMemberResponse,
} from '@tabletop/shared';
import type { ViewMode } from '@tabletop/shared';
import { supabaseService, getUserByEmail } from '../lib/supabaseService.js';
import { getCampaignRole } from '../lib/campaignRole.js';
import { stripDmFields, shouldStripDmFields } from '../lib/stripDmFields.js';
import {
  HttpError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  sendError,
} from '../lib/httpErrors.js';

export const campaignsRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

// The DB returns `null` for unset optional text fields, but Zod `.optional()`
// only accepts `undefined`. Coerce top-level nulls to undefined before parsing.
function nullToUndefined(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, v === null ? undefined : v]),
  );
}

function buildCampaignWithRole(
  row: Record<string, unknown>,
  role: 'dm' | 'player',
  view: ViewMode,
): CampaignWithRole {
  const normalized = nullToUndefined(row);
  const withRole = { ...normalized, my_role: role };
  const payload =
    shouldStripDmFields(view) || role === 'player'
      ? stripDmFields(withRole)
      : withRole;
  return CampaignWithRole.parse(payload);
}

// ─── GET /campaigns ───────────────────────────────────────────────────────────

campaignsRouter.get('/campaigns', async (req, res) => {
  try {
    const userId = req.user!.id;

    const { data, error } = await supabaseService
      .from('campaign_members')
      .select('role, campaigns(*)')
      .eq('user_id', userId);

    if (error) throw new HttpError(500, 'database error');

    const campaigns = (data ?? []).map((m) =>
      buildCampaignWithRole(
        m.campaigns as Record<string, unknown>,
        m.role as 'dm' | 'player',
        req.requestedView,
      ),
    );

    res.json(CampaignsResponse.parse({ campaigns }));
  } catch (err) {
    sendError(res, err);
  }
});

// ─── POST /campaigns ──────────────────────────────────────────────────────────

campaignsRouter.post('/campaigns', async (req, res) => {
  try {
    const userId = req.user!.id;

    const parsed = CampaignCreate.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('invalid body', parsed.error.flatten());
    }

    const { data: campaign, error: insertError } = await supabaseService
      .from('campaigns')
      .insert(parsed.data)
      .select('*')
      .single();

    if (insertError || !campaign) throw new HttpError(500, 'database error');

    const { error: memberError } = await supabaseService
      .from('campaign_members')
      .insert({ campaign_id: campaign.id, user_id: userId, role: 'dm' });

    if (memberError) {
      // Best-effort cleanup — campaign has no DM without the member row
      await supabaseService.from('campaigns').delete().eq('id', campaign.id);
      throw new HttpError(500, 'database error');
    }

    const body = CampaignResponse.parse({
      campaign: buildCampaignWithRole(
        campaign as Record<string, unknown>,
        'dm',
        'dm',
      ),
    });
    res.status(201).json(body);
  } catch (err) {
    sendError(res, err);
  }
});

// ─── GET /campaigns/:id ───────────────────────────────────────────────────────

campaignsRouter.get('/campaigns/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { data: campaign, error: campaignError } = await supabaseService
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (campaignError) throw new HttpError(500, 'database error');
    if (!campaign) throw new NotFoundError();

    const role = await getCampaignRole(userId, id);
    if (!role) throw new NotFoundError();

    res.json(
      CampaignResponse.parse({
        campaign: buildCampaignWithRole(
          campaign as Record<string, unknown>,
          role,
          req.requestedView,
        ),
      }),
    );
  } catch (err) {
    sendError(res, err);
  }
});

// ─── PUT /campaigns/:id ───────────────────────────────────────────────────────

campaignsRouter.put('/campaigns/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabaseService
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw new HttpError(500, 'database error');
    if (!existing) throw new NotFoundError();

    const role = await getCampaignRole(userId, id);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    const parsed = CampaignUpdate.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('invalid body', parsed.error.flatten());
    }

    const { data: updated, error: updateError } = await supabaseService
      .from('campaigns')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError || !updated) throw new HttpError(500, 'database error');

    res.json(
      CampaignResponse.parse({
        campaign: buildCampaignWithRole(
          updated as Record<string, unknown>,
          'dm',
          req.requestedView,
        ),
      }),
    );
  } catch (err) {
    sendError(res, err);
  }
});

// ─── DELETE /campaigns/:id ────────────────────────────────────────────────────

campaignsRouter.delete('/campaigns/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabaseService
      .from('campaigns')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw new HttpError(500, 'database error');
    if (!existing) throw new NotFoundError();

    const role = await getCampaignRole(userId, id);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    const { error: deleteError } = await supabaseService
      .from('campaigns')
      .delete()
      .eq('id', id);

    if (deleteError) throw new HttpError(500, 'database error');

    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
});

// ─── GET /campaigns/:id/members ───────────────────────────────────────────────

campaignsRouter.get('/campaigns/:id/members', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const role = await getCampaignRole(userId, id);
    if (!role) throw new NotFoundError();

    const { data, error } = await supabaseService
      .from('campaign_members')
      .select('*')
      .eq('campaign_id', id);

    if (error) throw new HttpError(500, 'database error');

    res.json(CampaignMembersResponse.parse({ members: data ?? [] }));
  } catch (err) {
    sendError(res, err);
  }
});

// ─── POST /campaigns/:id/members ─────────────────────────────────────────────

campaignsRouter.post('/campaigns/:id/members', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const role = await getCampaignRole(userId, id);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('invalid body', parsed.error.flatten());
    }

    const found = await getUserByEmail(parsed.data.email);
    if (!found) throw new NotFoundError('user_not_found');

    // Check for existing membership
    const { data: existing } = await supabaseService
      .from('campaign_members')
      .select('user_id')
      .eq('campaign_id', id)
      .eq('user_id', found.id)
      .maybeSingle();

    if (existing) {
      res.status(409).json({ error: 'already_member' });
      return;
    }

    const { data: member, error: insertError } = await supabaseService
      .from('campaign_members')
      .insert({ campaign_id: id, user_id: found.id, role: 'player' })
      .select('*')
      .single();

    if (insertError || !member) throw new HttpError(500, 'database error');

    res.status(201).json(CampaignMemberResponse.parse({ member }));
  } catch (err) {
    sendError(res, err);
  }
});

// ─── DELETE /campaigns/:id/members/:userId ────────────────────────────────────

campaignsRouter.delete('/campaigns/:id/members/:userId', async (req, res) => {
  try {
    const callerId = req.user!.id;
    const { id, userId } = req.params;

    const role = await getCampaignRole(callerId, id);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    if (userId === callerId) {
      res.status(400).json({ error: 'cannot_remove_self' });
      return;
    }

    const { data: target } = await supabaseService
      .from('campaign_members')
      .select('user_id')
      .eq('campaign_id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!target) throw new NotFoundError();

    const { error: deleteError } = await supabaseService
      .from('campaign_members')
      .delete()
      .eq('campaign_id', id)
      .eq('user_id', userId);

    if (deleteError) throw new HttpError(500, 'database error');

    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
});
