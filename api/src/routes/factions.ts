import { Router } from 'express';
import {
  Faction,
  FactionCreate,
  FactionUpdate,
  FactionResponse,
  FactionsResponse,
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

export const factionsRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nullToUndefined(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, v === null ? undefined : v]),
  );
}

// ─── GET /campaigns/:campaignId/factions ─────────────────────────────────────

factionsRouter.get('/campaigns/:campaignId/factions', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campaignId } = req.params;

    const role = await getCampaignRole(userId, campaignId);
    if (!role) throw new NotFoundError();

    const strip = role === 'player' || shouldStripDmFields(req.requestedView);

    const { data, error } = await supabaseService
      .from('factions')
      .select('*')
      .eq('campaign_id', campaignId);

    if (error) throw new HttpError(500, 'database error');

    const factions = (data ?? []).map((row) => {
      const parsed = Faction.parse(nullToUndefined(row as Record<string, unknown>));
      return strip ? stripDmFields(parsed) : parsed;
    });

    res.json(FactionsResponse.parse({ factions }));
  } catch (err) {
    sendError(res, err);
  }
});

// ─── POST /campaigns/:campaignId/factions ─────────────────────────────────────

factionsRouter.post('/campaigns/:campaignId/factions', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campaignId } = req.params;

    const role = await getCampaignRole(userId, campaignId);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    const parsed = FactionCreate.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('invalid body', parsed.error.flatten());
    }

    // Bind to the authorized campaign — never trust a client-supplied campaign_id.
    const { campaign_id: _ignored, ...rest } = parsed.data;
    const insertRow = { ...rest, campaign_id: campaignId };

    const { data, error } = await supabaseService
      .from('factions')
      .insert(insertRow)
      .select('*')
      .single();

    if (error || !data) throw new HttpError(500, 'database error');

    const faction = Faction.parse(nullToUndefined(data as Record<string, unknown>));
    res.status(201).json(FactionResponse.parse({ faction }));
  } catch (err) {
    sendError(res, err);
  }
});

// ─── GET /campaigns/:campaignId/factions/:factionId ──────────────────────────

factionsRouter.get('/campaigns/:campaignId/factions/:factionId', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campaignId, factionId } = req.params;

    const role = await getCampaignRole(userId, campaignId);
    if (!role) throw new NotFoundError();

    const { data, error } = await supabaseService
      .from('factions')
      .select('*')
      .eq('id', factionId)
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (error) throw new HttpError(500, 'database error');
    if (!data) throw new NotFoundError();

    const strip = role === 'player' || shouldStripDmFields(req.requestedView);
    const faction = Faction.parse(nullToUndefined(data as Record<string, unknown>));
    const payload = strip ? stripDmFields(faction) : faction;

    res.json(FactionResponse.parse({ faction: payload }));
  } catch (err) {
    sendError(res, err);
  }
});

// ─── PUT /campaigns/:campaignId/factions/:factionId ──────────────────────────

factionsRouter.put('/campaigns/:campaignId/factions/:factionId', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campaignId, factionId } = req.params;

    const { data: existing, error: fetchError } = await supabaseService
      .from('factions')
      .select('id')
      .eq('id', factionId)
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (fetchError) throw new HttpError(500, 'database error');
    if (!existing) throw new NotFoundError();

    const role = await getCampaignRole(userId, campaignId);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    const parsed = FactionUpdate.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('invalid body', parsed.error.flatten());
    }

    // Never allow campaign_id to be changed via update.
    const { campaign_id: _ignored, ...updatePayload } = parsed.data;

    const { data, error } = await supabaseService
      .from('factions')
      .update({ ...updatePayload, updated_at: new Date().toISOString() })
      .eq('id', factionId)
      .select('*')
      .single();

    if (error || !data) throw new HttpError(500, 'database error');

    const faction = Faction.parse(nullToUndefined(data as Record<string, unknown>));
    res.json(FactionResponse.parse({ faction }));
  } catch (err) {
    sendError(res, err);
  }
});

// ─── DELETE /campaigns/:campaignId/factions/:factionId ───────────────────────

factionsRouter.delete('/campaigns/:campaignId/factions/:factionId', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campaignId, factionId } = req.params;

    const { data: existing, error: fetchError } = await supabaseService
      .from('factions')
      .select('id')
      .eq('id', factionId)
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (fetchError) throw new HttpError(500, 'database error');
    if (!existing) throw new NotFoundError();

    const role = await getCampaignRole(userId, campaignId);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    const { error } = await supabaseService
      .from('factions')
      .delete()
      .eq('id', factionId);

    if (error) throw new HttpError(500, 'database error');

    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
});
