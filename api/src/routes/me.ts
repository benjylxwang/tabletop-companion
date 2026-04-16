import { Router } from 'express';
import { MeResponse } from '@tabletop/shared';

export const meRouter = Router();

// authMiddleware guarantees req.user is set before this handler runs.
meRouter.get('/me', (req, res) => {
  const body = MeResponse.parse({
    user: { id: req.user!.id, email: req.user!.email ?? null },
  });
  res.json(body);
});
