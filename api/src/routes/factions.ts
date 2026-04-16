import { Router } from 'express';
import {
  Faction,
  FactionCreate,
  FactionUpdate,
  FactionWithRefs,
  FactionWithRefsResponse,
  FactionMemberRef,
  FactionRelationshipRef,
  AddFactionMember,
  AddFactionRelationship,
} from '@tabletop/shared';
import { supabaseService } from '../lib/supabaseService.js';
import { getCampaignRole } from '../lib/campaignRole.js';
import { stripDmFields, shouldStripDmFields } from '../lib/stripDmFields.js';
import {
  HttpError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  sendError,
} from '../lib/httpErrors.js';
import { createCrudHandlers } from '../lib/crud.js';

export const factionsRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Coerce DB nulls to undefined so Zod `.optional()` accepts them.
function nullToUndefined(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, v === null ? undefined : v]),
  );
}

// ─── CRUD handlers (list, create, update, delete) ────────────────────────────

const handlers = createCrudHandlers({
  table: 'factions',
  baseSchema: Faction,
  createSchema: FactionCreate,
  updateSchema: FactionUpdate,
  responseKey: { single: 'faction', plural: 'factions' },
  resolveCampaignId: (req, row) => row?.campaign_id ?? req.params.campaignId ?? null,
});

factionsRouter.get('/campaigns/:campaignId/factions', handlers.list);
factionsRouter.post('/campaigns/:campaignId/factions', handlers.create);
factionsRouter.put('/campaigns/:campaignId/factions/:id', handlers.update);
factionsRouter.delete('/campaigns/:campaignId/factions/:id', handlers.remove);

// ─── GET /campaigns/:campaignId/factions/:id ─────────────────────────────────

factionsRouter.get('/campaigns/:campaignId/factions/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campaignId, id: factionId } = req.params;

    const role = await getCampaignRole(userId, campaignId);
    if (!role) throw new NotFoundError();

    const strip = role === 'player' || shouldStripDmFields(req.requestedView);

    // Fetch the faction row.
    const { data: factionData, error: factionError } = await supabaseService
      .from('factions')
      .select('*')
      .eq('id', factionId)
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (factionError) throw new HttpError(500, 'database error');
    if (!factionData) throw new NotFoundError();

    const faction = Faction.parse(nullToUndefined(factionData as Record<string, unknown>));

    // Parallel fetch: members (with NPC name) and relationships (with related faction name).
    const [membersResult, relshipsResult] = await Promise.all([
      supabaseService
        .from('faction_members')
        .select('npc_id, role, npcs(id, name)')
        .eq('faction_id', factionId as never),
      supabaseService
        .from('faction_relationships')
        .select(
          'related_faction_id, relationship_type, factions!faction_relationships_related_faction_id_fkey(id, name)',
        )
        .eq('faction_id', factionId as never),
    ]);

    if (membersResult.error) throw new HttpError(500, 'database error');
    if (relshipsResult.error) throw new HttpError(500, 'database error');

    const members: FactionMemberRef[] = (membersResult.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const npc = r.npcs as Record<string, unknown> | null;
      return FactionMemberRef.parse({
        npc_id: r.npc_id,
        npc_name: npc?.name ?? '',
        role: r.role ?? null,
      });
    });

    const relationships: FactionRelationshipRef[] = (relshipsResult.data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const related = r.factions as Record<string, unknown> | null;
      return FactionRelationshipRef.parse({
        related_faction_id: r.related_faction_id,
        related_faction_name: related?.name ?? '',
        relationship_type: r.relationship_type,
      });
    });

    const factionWithRefs = FactionWithRefs.parse({ ...faction, members, relationships });
    const payload = strip ? stripDmFields(factionWithRefs) : factionWithRefs;

    res.json(FactionWithRefsResponse.parse({ faction: payload }));
  } catch (err) {
    sendError(res, err);
  }
});

// ─── POST /campaigns/:campaignId/factions/:id/members ────────────────────────

factionsRouter.post('/campaigns/:campaignId/factions/:id/members', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campaignId, id: factionId } = req.params;

    const role = await getCampaignRole(userId, campaignId);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    // Verify faction belongs to campaign.
    const { data: existing, error: fetchError } = await supabaseService
      .from('factions')
      .select('id')
      .eq('id', factionId)
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (fetchError) throw new HttpError(500, 'database error');
    if (!existing) throw new NotFoundError();

    const parsed = AddFactionMember.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('invalid body', parsed.error.flatten());
    }

    const { error } = await supabaseService
      .from('faction_members')
      .insert({
        faction_id: factionId,
        npc_id: parsed.data.npc_id,
        role: parsed.data.role ?? null,
      } as never);

    if (error) throw new HttpError(500, 'database error');

    res.status(201).end();
  } catch (err) {
    sendError(res, err);
  }
});

// ─── DELETE /campaigns/:campaignId/factions/:id/members/:npcId ───────────────

factionsRouter.delete('/campaigns/:campaignId/factions/:id/members/:npcId', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campaignId, id: factionId, npcId } = req.params;

    const role = await getCampaignRole(userId, campaignId);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    // Verify faction belongs to campaign.
    const { data: existing, error: fetchError } = await supabaseService
      .from('factions')
      .select('id')
      .eq('id', factionId)
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (fetchError) throw new HttpError(500, 'database error');
    if (!existing) throw new NotFoundError();

    const { error } = await supabaseService
      .from('faction_members')
      .delete()
      .eq('faction_id', factionId as never)
      .eq('npc_id', npcId as never);

    if (error) throw new HttpError(500, 'database error');

    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
});

// ─── POST /campaigns/:campaignId/factions/:id/relationships ──────────────────

factionsRouter.post('/campaigns/:campaignId/factions/:id/relationships', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campaignId, id: factionId } = req.params;

    const role = await getCampaignRole(userId, campaignId);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    // Verify faction belongs to campaign.
    const { data: existing, error: fetchError } = await supabaseService
      .from('factions')
      .select('id')
      .eq('id', factionId)
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (fetchError) throw new HttpError(500, 'database error');
    if (!existing) throw new NotFoundError();

    const parsed = AddFactionRelationship.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('invalid body', parsed.error.flatten());
    }

    const { error } = await supabaseService
      .from('faction_relationships')
      .insert({
        faction_id: factionId,
        related_faction_id: parsed.data.related_faction_id,
        relationship_type: parsed.data.relationship_type,
      } as never);

    if (error) throw new HttpError(500, 'database error');

    res.status(201).end();
  } catch (err) {
    sendError(res, err);
  }
});

// ─── DELETE /campaigns/:campaignId/factions/:id/relationships/:relatedFactionId

factionsRouter.delete(
  '/campaigns/:campaignId/factions/:id/relationships/:relatedFactionId',
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const { campaignId, id: factionId, relatedFactionId } = req.params;

      const role = await getCampaignRole(userId, campaignId);
      if (!role) throw new NotFoundError();
      if (role !== 'dm') throw new ForbiddenError();

      // Verify faction belongs to campaign.
      const { data: existing, error: fetchError } = await supabaseService
        .from('factions')
        .select('id')
        .eq('id', factionId)
        .eq('campaign_id', campaignId)
        .maybeSingle();

      if (fetchError) throw new HttpError(500, 'database error');
      if (!existing) throw new NotFoundError();

      const { error } = await supabaseService
        .from('faction_relationships')
        .delete()
        .eq('faction_id', factionId as never)
        .eq('related_faction_id', relatedFactionId as never);

      if (error) throw new HttpError(500, 'database error');

      res.status(204).end();
    } catch (err) {
      sendError(res, err);
    }
  },
);
