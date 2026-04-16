import { Router } from 'express';
import { CampaignsResponse } from '@tabletop/shared';

export const campaignsRouter = Router();

campaignsRouter.get('/campaigns', (_req, res) => {
  const body = CampaignsResponse.parse({ campaigns: [] });
  res.json(body);
});
