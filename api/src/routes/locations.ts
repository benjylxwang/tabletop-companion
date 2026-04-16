import { Router } from 'express';
import { Location, LocationCreate, LocationUpdate } from '@tabletop/shared';
import { createCrudHandlers } from '../lib/crud.js';

export const locationsRouter = Router();

const handlers = createCrudHandlers({
  table: 'locations',
  baseSchema: Location,
  createSchema: LocationCreate,
  updateSchema: LocationUpdate,
  responseKey: { single: 'location', plural: 'locations' },
  // Locations are nested under a campaign; the URL is the only trusted source
  // of the campaign binding. For routes operating on a specific row, the row's
  // own campaign_id is authoritative.
  resolveCampaignId: (req, row) => row?.campaign_id ?? req.params.campaignId ?? null,
});

locationsRouter.get('/campaigns/:campaignId/locations', handlers.list);
locationsRouter.post('/campaigns/:campaignId/locations', handlers.create);
locationsRouter.get('/campaigns/:campaignId/locations/:id', handlers.get);
locationsRouter.put('/campaigns/:campaignId/locations/:id', handlers.update);
locationsRouter.delete('/campaigns/:campaignId/locations/:id', handlers.remove);
