import { Router } from 'express';
import {
  Lore,
  LoreCreate,
  LoreUpdate,
  LoreListResponse,
  LoreResponse,
  LoreWithRefs,
  LoreWithRefsResponse,
  AddLoreReference,
  LoreReferenceEntityTypeEnum,
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

    // Fetch lore_references for this entry
    const { data: refsData, error: refsError } = await supabaseService
      .from('lore_references')
      .select('entity_type, entity_id')
      .eq('lore_id', loreId);

    if (refsError) throw new HttpError(500, 'database error');

    const rawRefs = refsData ?? [];

    // Group entity ids by type for efficient batch resolution
    const byType = new Map<string, string[]>();
    for (const ref of rawRefs) {
      const list = byType.get(ref.entity_type) ?? [];
      list.push(ref.entity_id);
      byType.set(ref.entity_type, list);
    }

    // Resolve entity names in parallel, one query per entity type
    type NameRow = { id: string; name: string } | { id: string; title: string };
    const nameMap = new Map<string, string>();

    await Promise.all(
      Array.from(byType.entries()).map(async ([entityType, ids]) => {
        const validType = LoreReferenceEntityTypeEnum.safeParse(entityType);
        if (!validType.success) return;

        // sessions and lore use `title` as display name; others use `name`
        const nameField = entityType === 'session' || entityType === 'lore' ? 'title' : 'name';
        const table =
          entityType === 'session'
            ? 'sessions'
            : entityType === 'character'
            ? 'characters'
            : entityType === 'npc'
            ? 'npcs'
            : entityType === 'location'
            ? 'locations'
            : entityType === 'faction'
            ? 'factions'
            : 'lore';

        const { data: nameRows, error: nameError } = await supabaseService
          .from(table as never)
          .select(`id, ${nameField}`)
          .in('id', ids);

        if (nameError) return;

        for (const row of (nameRows ?? []) as NameRow[]) {
          const displayName = 'name' in row ? row.name : row.title;
          nameMap.set(row.id, displayName);
        }
      }),
    );

    const references = rawRefs.map((ref) => ({
      entity_type: ref.entity_type as LoreReferenceEntityTypeEnum,
      entity_id: ref.entity_id,
      entity_name: nameMap.get(ref.entity_id) ?? '',
    }));

    const lorePayload = strip ? stripDmFields(lore) : lore;

    const withRefs = LoreWithRefs.parse({ ...lorePayload, references });
    res.json(LoreWithRefsResponse.parse({ lore: withRefs }));
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

// ─── POST /campaigns/:campaignId/lore/:loreId/references ─────────────────────

loreRouter.post('/campaigns/:campaignId/lore/:loreId/references', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { campaignId, loreId } = req.params;

    const role = await getCampaignRole(userId, campaignId);
    if (!role) throw new NotFoundError();
    if (role !== 'dm') throw new ForbiddenError();

    // Verify lore belongs to this campaign
    const { data: existing, error: fetchError } = await supabaseService
      .from('lore')
      .select('id')
      .eq('id', loreId)
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (fetchError) throw new HttpError(500, 'database error');
    if (!existing) throw new NotFoundError();

    const parsed = AddLoreReference.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('invalid body', parsed.error.flatten());
    }

    const { error } = await supabaseService
      .from('lore_references')
      .insert({
        lore_id: loreId,
        entity_type: parsed.data.entity_type,
        entity_id: parsed.data.entity_id,
      } as never);

    if (error) throw new HttpError(500, 'database error');

    res.status(201).end();
  } catch (err) {
    sendError(res, err);
  }
});

// ─── DELETE /campaigns/:campaignId/lore/:loreId/references/:entityType/:entityId

loreRouter.delete(
  '/campaigns/:campaignId/lore/:loreId/references/:entityType/:entityId',
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const { campaignId, loreId, entityType, entityId } = req.params;

      const role = await getCampaignRole(userId, campaignId);
      if (!role) throw new NotFoundError();
      if (role !== 'dm') throw new ForbiddenError();

      const { error } = await supabaseService
        .from('lore_references')
        .delete()
        .eq('lore_id', loreId)
        .eq('entity_type', entityType as never)
        .eq('entity_id', entityId);

      if (error) throw new HttpError(500, 'database error');

      res.status(204).end();
    } catch (err) {
      sendError(res, err);
    }
  },
);
