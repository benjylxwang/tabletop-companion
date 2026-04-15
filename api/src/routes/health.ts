import { Router } from 'express';
import { HealthResponse } from '@tabletop/shared';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  const body = HealthResponse.parse({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
  res.json(body);
});
