import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  Npc,
  NpcCreate,
  NpcUpdate,
  NpcWithRefs,
  NpcWithRefsResponse,
} from '@tabletop/shared';
import { supabaseService } from '../lib/supabaseService.js';
import { getCampaignRole } from '../lib/campaignRole.js';
import { stripDmFields, shouldStripDmFields } from '../lib/stripDmFields.js';
import { HttpError, NotFoundError, sendError } from '../lib/httpErrors.js';
import { createCrudHandlers } from '../lib/crud.js';

export const npcsRouter = Router();

const handlers = createCrudHandlers({
  table: 'npcs',
  baseSchema: Npc,
  createSchema: NpcCreate,
  updateSchema: NpcUpdate,
  responseKey: { single: 'npc', plural: 'npcs' },
  // NPCs are nested under a campaign; the URL is the only trusted source of
  // the campaign binding. For routes operating on a specific row, the row's
  // own campaign_id is authoritative.
  resolveCampaignId: (req, row) => row?.campaign_id ?? req.params.campaignId ?? null,
});

// Custom get handler — enriches NPC with faction and first-appeared session refs
async function getNpc(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new HttpError(500, 'auth middleware missing');

    const { campaignId, id } = req.params;

    const { data: npcData, error: npcError } = await supabaseService
      .from('npcs')
      .select('*')
      .eq('id', id)
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (npcError) throw new HttpError(500, 'database error');
    if (!npcData) throw new NotFoundError();

    const role = await getCampaignRole(userId, campaignId, supabaseService);
    if (!role) throw new NotFoundError();

    // Coerce DB nulls to undefined for Zod compatibility
    function nullToUndefined(row: Record<string, unknown>): Record<string, unknown> {
      return Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, v === null ? undefined : v]),
      );
    }

    const npc = Npc.parse(nullToUndefined(npcData as Record<string, unknown>));

    // Fetch faction and first-appeared session in parallel if referenced
    const [factionResult, sessionResult] = await Promise.all([
      npc.faction_id
        ? supabaseService
            .from('factions')
            .select('id, name')
            .eq('id', npc.faction_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      npc.first_appeared_session_id
        ? supabaseService
            .from('sessions')
            .select('id, title, session_number')
            .eq('id', npc.first_appeared_session_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (factionResult.error) throw new HttpError(500, 'database error');
    if (sessionResult.error) throw new HttpError(500, 'database error');

    const faction =
      factionResult.data != null
        ? (factionResult.data as { id: string; name: string })
        : undefined;

    const sessionRow = sessionResult.data as {
      id: string;
      title: string;
      session_number: number;
    } | null;

    const first_appeared_session =
      sessionRow != null
        ? { id: sessionRow.id, name: sessionRow.title, session_number: sessionRow.session_number }
        : undefined;

    const strip = role === 'player' || shouldStripDmFields(req.requestedView);
    const npcPayload = strip ? stripDmFields(npc) : npc;

    const withRefs = NpcWithRefs.parse({
      ...npcPayload,
      faction,
      first_appeared_session,
    });

    res.status(200).json(NpcWithRefsResponse.parse({ npc: withRefs }));
  } catch (err) {
    sendError(res, err);
  }
}

npcsRouter.get('/campaigns/:campaignId/npcs', handlers.list);
npcsRouter.post('/campaigns/:campaignId/npcs', handlers.create);
npcsRouter.get('/campaigns/:campaignId/npcs/:id', getNpc);
npcsRouter.put('/campaigns/:campaignId/npcs/:id', handlers.update);
npcsRouter.delete('/campaigns/:campaignId/npcs/:id', handlers.remove);
