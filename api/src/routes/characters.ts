import { Router } from 'express';
import {
  Character,
  CharacterCreate,
  CharacterUpdate,
} from '@tabletop/shared';
import { createCrudHandlers } from '../lib/crud.js';

const handlers = createCrudHandlers({
  table: 'characters',
  baseSchema: Character,
  createSchema: CharacterCreate,
  updateSchema: CharacterUpdate,
  responseKey: { single: 'character', plural: 'characters' },
  resolveCampaignId: (req, row) => row?.campaign_id ?? req.params.campaignId ?? null,
});

export const charactersRouter = Router();

charactersRouter.get('/campaigns/:campaignId/characters', handlers.list);
charactersRouter.get('/campaigns/:campaignId/characters/:id', handlers.get);
charactersRouter.post('/campaigns/:campaignId/characters', handlers.create);
charactersRouter.patch('/campaigns/:campaignId/characters/:id', handlers.update);
charactersRouter.delete('/campaigns/:campaignId/characters/:id', handlers.remove);
