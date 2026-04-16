import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  Session,
  SessionCreate,
  SessionUpdate,
  SessionWithRefs,
  SessionWithRefsResponse,
} from '@tabletop/shared';
import { supabaseService } from '../lib/supabaseService.js';
import { getCampaignRole } from '../lib/campaignRole.js';
import { stripDmFields, shouldStripDmFields } from '../lib/stripDmFields.js';
import {
  HttpError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  sendError,
} from '../lib/httpErrors.js';
import { createCrudHandlers } from '../lib/crud.js';
import { z } from 'zod';

export const sessionsRouter = Router();

const handlers = createCrudHandlers({
  table: 'sessions',
  baseSchema: Session,
  createSchema: SessionCreate,
  updateSchema: SessionUpdate,
  responseKey: { single: 'session', plural: 'sessions' },
  resolveCampaignId: (req) => req.params.campaignId,
});

// Custom list handler — sorts by session_number desc
async function listSessions(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new HttpError(500, 'auth middleware missing');

    const campaignId = req.params.campaignId;
    const role = await getCampaignRole(userId, campaignId, supabaseService);
    if (!role) throw new NotFoundError();

    const { data, error } = await supabaseService
      .from('sessions')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('session_number', { ascending: false });
    if (error) throw new HttpError(500, 'database error');

    const rows = (data ?? []).map((r) => Session.parse(r));
    const strip = role === 'player' || shouldStripDmFields(req.requestedView);
    const payload = strip ? rows.map((r) => stripDmFields(r)) : rows;
    res.status(200).json({ sessions: payload });
  } catch (err) {
    sendError(res, err);
  }
}

// Custom get handler — fetches session with linked NPCs and locations
async function getSession(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new HttpError(500, 'auth middleware missing');

    const { campaignId, id } = req.params;

    const role = await getCampaignRole(userId, campaignId, supabaseService);
    if (!role) throw new NotFoundError();

    const { data: sessionData, error: sessionError } = await supabaseService
      .from('sessions')
      .select('*')
      .eq('id', id)
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (sessionError) throw new HttpError(500, 'database error');
    if (!sessionData) throw new NotFoundError();

    // Fetch linked NPCs and locations in parallel
    const [npcsResult, locationsResult] = await Promise.all([
      supabaseService
        .from('session_npcs')
        .select('npc_id, npcs(id, name)')
        .eq('session_id', id),
      supabaseService
        .from('session_locations')
        .select('location_id, locations(id, name)')
        .eq('session_id', id),
    ]);

    if (npcsResult.error) throw new HttpError(500, 'database error');
    if (locationsResult.error) throw new HttpError(500, 'database error');

    const linked_npcs = (npcsResult.data ?? []).map((row) => {
      const npc = row.npcs as { id: string; name: string } | null;
      return { id: npc?.id ?? row.npc_id, name: npc?.name ?? '' };
    });

    const linked_locations = (locationsResult.data ?? []).map((row) => {
      const loc = row.locations as { id: string; name: string } | null;
      return { id: loc?.id ?? row.location_id, name: loc?.name ?? '' };
    });

    const session = Session.parse(sessionData);
    const strip = role === 'player' || shouldStripDmFields(req.requestedView);
    const sessionPayload = strip ? stripDmFields(session) : session;

    const withRefs = SessionWithRefs.parse({
      ...sessionPayload,
      linked_npcs,
      linked_locations,
    });

    res.status(200).json(SessionWithRefsResponse.parse({ session: withRefs }));
  } catch (err) {
    sendError(res, err);
  }
}

// POST /campaigns/:campaignId/sessions/:id/npcs — DM only
async function linkNpc(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new HttpError(500, 'auth middleware missing');

    const { campaignId, id } = req.params;

    const role = await getCampaignRole(userId, campaignId, supabaseService);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    const parsed = z.object({ npc_id: z.string() }).safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('invalid body', parsed.error.flatten());
    }

    // Verify the session belongs to this campaign.
    const { data: sessionExistsNpc, error: sessionCheckNpcError } = await supabaseService
      .from('sessions')
      .select('id')
      .eq('id', id)
      .eq('campaign_id', campaignId)
      .maybeSingle();
    if (sessionCheckNpcError) throw new HttpError(500, 'database error');
    if (!sessionExistsNpc) throw new NotFoundError();

    // Verify the NPC belongs to this campaign to prevent cross-campaign link tampering.
    const { data: npcExists, error: npcCheckError } = await supabaseService
      .from('npcs')
      .select('id')
      .eq('id', parsed.data.npc_id)
      .eq('campaign_id', campaignId)
      .maybeSingle();
    if (npcCheckError) throw new HttpError(500, 'database error');
    if (!npcExists) throw new NotFoundError();

    const { error } = await supabaseService
      .from('session_npcs')
      .insert({ session_id: id, npc_id: parsed.data.npc_id } as never);

    if (error) throw new HttpError(500, 'database error');

    res.status(201).end();
  } catch (err) {
    sendError(res, err);
  }
}

// DELETE /campaigns/:campaignId/sessions/:id/npcs/:npcId — DM only
async function unlinkNpc(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new HttpError(500, 'auth middleware missing');

    const { campaignId, id, npcId } = req.params;

    const role = await getCampaignRole(userId, campaignId, supabaseService);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    const { error } = await supabaseService
      .from('session_npcs')
      .delete()
      .eq('session_id', id)
      .eq('npc_id', npcId);

    if (error) throw new HttpError(500, 'database error');

    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
}

// POST /campaigns/:campaignId/sessions/:id/locations — DM only
async function linkLocation(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new HttpError(500, 'auth middleware missing');

    const { campaignId, id } = req.params;

    const role = await getCampaignRole(userId, campaignId, supabaseService);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    const parsed = z.object({ location_id: z.string() }).safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('invalid body', parsed.error.flatten());
    }

    // Verify the session belongs to this campaign.
    const { data: sessionExistsLoc, error: sessionCheckLocError } = await supabaseService
      .from('sessions')
      .select('id')
      .eq('id', id)
      .eq('campaign_id', campaignId)
      .maybeSingle();
    if (sessionCheckLocError) throw new HttpError(500, 'database error');
    if (!sessionExistsLoc) throw new NotFoundError();

    // Verify the location belongs to this campaign to prevent cross-campaign link tampering.
    const { data: locExists, error: locCheckError } = await supabaseService
      .from('locations')
      .select('id')
      .eq('id', parsed.data.location_id)
      .eq('campaign_id', campaignId)
      .maybeSingle();
    if (locCheckError) throw new HttpError(500, 'database error');
    if (!locExists) throw new NotFoundError();

    const { error } = await supabaseService
      .from('session_locations')
      .insert({ session_id: id, location_id: parsed.data.location_id } as never);

    if (error) throw new HttpError(500, 'database error');

    res.status(201).end();
  } catch (err) {
    sendError(res, err);
  }
}

// DELETE /campaigns/:campaignId/sessions/:id/locations/:locationId — DM only
async function unlinkLocation(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new HttpError(500, 'auth middleware missing');

    const { campaignId, id, locationId } = req.params;

    const role = await getCampaignRole(userId, campaignId, supabaseService);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    const { error } = await supabaseService
      .from('session_locations')
      .delete()
      .eq('session_id', id)
      .eq('location_id', locationId);

    if (error) throw new HttpError(500, 'database error');

    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
}

sessionsRouter.get('/campaigns/:campaignId/sessions', listSessions);
sessionsRouter.post('/campaigns/:campaignId/sessions', handlers.create);
sessionsRouter.get('/campaigns/:campaignId/sessions/:id', getSession);
sessionsRouter.patch('/campaigns/:campaignId/sessions/:id', handlers.update);
sessionsRouter.delete('/campaigns/:campaignId/sessions/:id', handlers.remove);

// Sub-resource routes — session NPC/location links
sessionsRouter.post('/campaigns/:campaignId/sessions/:id/npcs', linkNpc);
sessionsRouter.delete('/campaigns/:campaignId/sessions/:id/npcs/:npcId', unlinkNpc);
sessionsRouter.post('/campaigns/:campaignId/sessions/:id/locations', linkLocation);
sessionsRouter.delete('/campaigns/:campaignId/sessions/:id/locations/:locationId', unlinkLocation);
