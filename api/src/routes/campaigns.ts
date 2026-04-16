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
  CampaignInvitationResponse,
  CampaignPendingInvitationsResponse,
  Session,
  Character,
  Npc,
  Location,
  Faction,
  Lore,
  CampaignOverview,
  CampaignOverviewResponse,
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

    const { data: membersData, error } = await supabaseService
      .from('campaign_members')
      .select('*')
      .eq('campaign_id', id);

    if (error) throw new HttpError(500, 'database error');

    const userIds = (membersData ?? []).map((m) => m.user_id as string);
    const profilesMap: Record<string, { email: string; display_name: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profilesData } = await supabaseService
        .from('profiles')
        .select('id, email, display_name')
        .in('id', userIds);
      for (const p of (profilesData ?? []) as { id: string; email: string; display_name: string | null }[]) {
        profilesMap[p.id] = { email: p.email, display_name: p.display_name };
      }
    }

    const members = (membersData ?? []).map((m) => ({
      ...m,
      display_name: profilesMap[m.user_id as string]?.display_name ?? null,
      email: profilesMap[m.user_id as string]?.email ?? null,
    }));

    res.json(CampaignMembersResponse.parse({ members }));
  } catch (err) {
    sendError(res, err);
  }
});

// ─── POST /campaigns/:id/members ─────────────────────────────────────────────
// Creates a pending invitation rather than adding directly to the campaign.
// The invited user will see it in their list and can accept or decline.

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
    const { data: existingMember } = await supabaseService
      .from('campaign_members')
      .select('user_id')
      .eq('campaign_id', id)
      .eq('user_id', found.id)
      .maybeSingle();

    if (existingMember) {
      res.status(409).json({ error: 'already_member' });
      return;
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabaseService
      .from('campaign_invitations')
      .select('id')
      .eq('campaign_id', id)
      .eq('invited_user_id', found.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvite) {
      res.status(409).json({ error: 'already_invited' });
      return;
    }

    const { data: invitation, error: insertError } = await supabaseService
      .from('campaign_invitations')
      .insert({
        campaign_id: id,
        invited_user_id: found.id,
        invited_by_user_id: userId,
      })
      .select('*')
      .single();

    if (insertError || !invitation) throw new HttpError(500, 'database error');

    res.status(201).json(CampaignInvitationResponse.parse({ invitation }));
  } catch (err) {
    sendError(res, err);
  }
});

// ─── GET /campaigns/:id/invitations ──────────────────────────────────────────
// DM-only: list pending invitations for a campaign.

campaignsRouter.get('/campaigns/:id/invitations', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const role = await getCampaignRole(userId, id);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    const { data, error } = await supabaseService
      .from('campaign_invitations')
      .select('*')
      .eq('campaign_id', id)
      .eq('status', 'pending');

    if (error) throw new HttpError(500, 'database error');

    const invitedIds = (data ?? []).map((inv) => inv.invited_user_id as string);
    const profilesMap: Record<string, { email: string; display_name: string | null }> = {};
    if (invitedIds.length > 0) {
      const { data: profilesData } = await supabaseService
        .from('profiles')
        .select('id, email, display_name')
        .in('id', invitedIds);
      for (const p of (profilesData ?? []) as { id: string; email: string; display_name: string | null }[]) {
        profilesMap[p.id] = { email: p.email, display_name: p.display_name };
      }
    }

    const invitations = (data ?? []).map((inv) => ({
      ...inv,
      invited_user_display_name: profilesMap[inv.invited_user_id as string]?.display_name ?? null,
      invited_user_email: profilesMap[inv.invited_user_id as string]?.email ?? null,
    }));

    res.json(CampaignPendingInvitationsResponse.parse({ invitations }));
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

// ─── GET /campaigns/:id/overview ─────────────────────────────────────────────

campaignsRouter.get('/campaigns/:id/overview', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const role = await getCampaignRole(userId, id);
    if (!role) throw new NotFoundError();

    const strip = shouldStripDmFields(req.requestedView) || role === 'player';

    // Fetch all data and stat counts in parallel
    const [
      sessionsResult,
      charactersResult,
      npcsResult,
      locationsResult,
      factionsResult,
      sessionCountResult,
      characterCountResult,
      npcCountResult,
      locationCountResult,
      factionCountResult,
      loreCountResult,
    ] = await Promise.all([
      supabaseService
        .from('sessions')
        .select('*')
        .eq('campaign_id', id)
        .order('session_number', { ascending: false })
        .limit(5),
      supabaseService
        .from('characters')
        .select('*')
        .eq('campaign_id', id),
      supabaseService
        .from('npcs')
        .select('*')
        .eq('campaign_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabaseService
        .from('locations')
        .select('*')
        .eq('campaign_id', id),
      supabaseService
        .from('factions')
        .select('*')
        .eq('campaign_id', id),
      supabaseService
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id),
      supabaseService
        .from('characters')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id),
      supabaseService
        .from('npcs')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id),
      supabaseService
        .from('locations')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id),
      supabaseService
        .from('factions')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id),
      supabaseService
        .from('lore')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id),
    ]);

    if (sessionsResult.error) throw new HttpError(500, 'database error');
    if (charactersResult.error) throw new HttpError(500, 'database error');
    if (npcsResult.error) throw new HttpError(500, 'database error');
    if (locationsResult.error) throw new HttpError(500, 'database error');
    if (factionsResult.error) throw new HttpError(500, 'database error');
    if (sessionCountResult.error) throw new HttpError(500, 'database error');
    if (characterCountResult.error) throw new HttpError(500, 'database error');
    if (npcCountResult.error) throw new HttpError(500, 'database error');
    if (locationCountResult.error) throw new HttpError(500, 'database error');
    if (factionCountResult.error) throw new HttpError(500, 'database error');
    if (loreCountResult.error) throw new HttpError(500, 'database error');

    function parseRows<T>(
      rows: Record<string, unknown>[],
      schema: { parse: (v: unknown) => T },
    ): T[] {
      return rows.map((r) => schema.parse(nullToUndefined(r)));
    }

    const recent_sessions = parseRows(
      (sessionsResult.data ?? []) as Record<string, unknown>[],
      Session,
    );
    const characters = parseRows(
      (charactersResult.data ?? []) as Record<string, unknown>[],
      Character,
    );
    const key_npcs = parseRows(
      (npcsResult.data ?? []) as Record<string, unknown>[],
      Npc,
    );
    const locations = parseRows(
      (locationsResult.data ?? []) as Record<string, unknown>[],
      Location,
    );
    const factions = parseRows(
      (factionsResult.data ?? []) as Record<string, unknown>[],
      Faction,
    );

    const overview = CampaignOverview.parse({
      recent_sessions: strip ? recent_sessions.map((s) => stripDmFields(s)) : recent_sessions,
      characters: strip ? characters.map((c) => stripDmFields(c)) : characters,
      key_npcs: strip ? key_npcs.map((n) => stripDmFields(n)) : key_npcs,
      locations: strip ? locations.map((l) => stripDmFields(l)) : locations,
      factions: strip ? factions.map((f) => stripDmFields(f)) : factions,
      stats: {
        sessions: sessionCountResult.count ?? 0,
        characters: characterCountResult.count ?? 0,
        npcs: npcCountResult.count ?? 0,
        locations: locationCountResult.count ?? 0,
        factions: factionCountResult.count ?? 0,
        lore: loreCountResult.count ?? 0,
      },
    });

    res.json(CampaignOverviewResponse.parse({ overview }));
  } catch (err) {
    sendError(res, err);
  }
});
