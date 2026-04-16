import { Router } from 'express';
import {
  Lore,
  LoreCreate,
  LoreUpdate,
  LoreListResponse,
  LoreResponse,
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

export const loreRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Coerce DB nulls to undefined so Zod `.optional()` accepts them.
function nullToUndefined(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, v === null ? undefined : v]),
  );
}

// ─── GET /campaigns/:campaignId/lore ─────────────────────────────────────────

loreRouter.get('/campaigns/:campaignId/lore', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campaignId } = req.params;

    const role = await getCampaignRole(userId, campaignId);
    if (!role) throw new NotFoundError();

    const strip = role === 'player' || shouldStripDmFields(req.requestedView);

    let query = supabaseService
      .from('lore')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });

    // Row-filter: Private entries are completely hidden from player view.
    // This is lore's unique permission behaviour — not just field stripping.
    // Cast needed: generated Supabase types still reflect the old lowercase DB
    // constraint; fix_lore_case migration updates the DB to Title Case.
    if (strip) {
      query = query.eq('visibility', 'Public' as never);
    }

    const { data, error } = await query;
    if (error) throw new HttpError(500, 'database error');

    const entries = (data ?? []).map((row) => {
      const lore = Lore.parse(nullToUndefined(row as Record<string, unknown>));
      return strip ? stripDmFields(lore) : lore;
    });

    res.json(LoreListResponse.parse({ lore: entries }));
  } catch (err) {
    sendError(res, err);
  }
});

// ─── POST /campaigns/:campaignId/lore ────────────────────────────────────────

loreRouter.post('/campaigns/:campaignId/lore', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campaignId } = req.params;

    const role = await getCampaignRole(userId, campaignId);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    // Inject campaign_id from URL — never trust a client-supplied campaign_id.
    const parsed = LoreCreate.safeParse({ ...req.body, campaign_id: campaignId });
    if (!parsed.success) {
      throw new ValidationError('invalid body', parsed.error.flatten());
    }

    const insertRow = parsed.data;

    // Cast to bypass Supabase generated types (Title Case vs lowercase — see above).
    const { data, error } = await supabaseService
      .from('lore')
      .insert(insertRow as never)
      .select('*')
      .single();

    if (error || !data) throw new HttpError(500, 'database error');

    const lore = Lore.parse(nullToUndefined(data as Record<string, unknown>));
    res.status(201).json(LoreResponse.parse({ lore }));
  } catch (err) {
    sendError(res, err);
  }
});

// ─── GET /campaigns/:campaignId/lore/:loreId ─────────────────────────────────

loreRouter.get('/campaigns/:campaignId/lore/:loreId', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campaignId, loreId } = req.params;

    const role = await getCampaignRole(userId, campaignId);
    if (!role) throw new NotFoundError();

    const { data, error } = await supabaseService
      .from('lore')
      .select('*')
      .eq('id', loreId)
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (error) throw new HttpError(500, 'database error');
    if (!data) throw new NotFoundError();

    const strip = role === 'player' || shouldStripDmFields(req.requestedView);

    // Private entries are completely hidden from player view — treat as not found.
    if (strip && (data as Record<string, unknown>).visibility === 'Private') {
      throw new NotFoundError();
    }

    const lore = Lore.parse(nullToUndefined(data as Record<string, unknown>));
    const payload = strip ? stripDmFields(lore) : lore;

    res.json(LoreResponse.parse({ lore: payload }));
  } catch (err) {
    sendError(res, err);
  }
});

// ─── PUT /campaigns/:campaignId/lore/:loreId ─────────────────────────────────

loreRouter.put('/campaigns/:campaignId/lore/:loreId', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campaignId, loreId } = req.params;

    const { data: existing, error: fetchError } = await supabaseService
      .from('lore')
      .select('id')
      .eq('id', loreId)
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (fetchError) throw new HttpError(500, 'database error');
    if (!existing) throw new NotFoundError();

    const role = await getCampaignRole(userId, campaignId);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    const parsed = LoreUpdate.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('invalid body', parsed.error.flatten());
    }

    // Never allow campaign_id to be changed via update.
    const { campaign_id: _ignored, ...updatePayload } = parsed.data;

    const { data, error } = await supabaseService
      .from('lore')
      .update({ ...updatePayload, updated_at: new Date().toISOString() } as never)
      .eq('id', loreId)
      .select('*')
      .single();

    if (error || !data) throw new HttpError(500, 'database error');

    const lore = Lore.parse(nullToUndefined(data as Record<string, unknown>));
    res.json(LoreResponse.parse({ lore }));
  } catch (err) {
    sendError(res, err);
  }
});

// ─── DELETE /campaigns/:campaignId/lore/:loreId ──────────────────────────────

loreRouter.delete('/campaigns/:campaignId/lore/:loreId', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campaignId, loreId } = req.params;

    const { data: existing, error: fetchError } = await supabaseService
      .from('lore')
      .select('id')
      .eq('id', loreId)
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (fetchError) throw new HttpError(500, 'database error');
    if (!existing) throw new NotFoundError();

    const role = await getCampaignRole(userId, campaignId);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    const { error } = await supabaseService
      .from('lore')
      .delete()
      .eq('id', loreId);

    if (error) throw new HttpError(500, 'database error');

    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
});
