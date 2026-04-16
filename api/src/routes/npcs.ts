import { Router } from 'express';
import { Npc, NpcCreate, NpcUpdate } from '@tabletop/shared';
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

npcsRouter.get('/campaigns/:campaignId/npcs', handlers.list);
npcsRouter.post('/campaigns/:campaignId/npcs', handlers.create);
npcsRouter.get('/campaigns/:campaignId/npcs/:id', handlers.get);
npcsRouter.put('/campaigns/:campaignId/npcs/:id', handlers.update);
npcsRouter.delete('/campaigns/:campaignId/npcs/:id', handlers.remove);
