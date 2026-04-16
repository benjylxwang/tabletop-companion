import { Router } from 'express';
import { Faction, FactionCreate, FactionUpdate } from '@tabletop/shared';
import { createCrudHandlers } from '../lib/crud.js';

export const factionsRouter = Router();

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
factionsRouter.get('/campaigns/:campaignId/factions/:id', handlers.get);
factionsRouter.put('/campaigns/:campaignId/factions/:id', handlers.update);
factionsRouter.delete('/campaigns/:campaignId/factions/:id', handlers.remove);
