import type { Request, Response, NextFunction } from 'express';
import { ViewMode } from '@tabletop/shared';

export function viewModeMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const parsed = ViewMode.safeParse(req.query.view);
  req.requestedView = parsed.success && parsed.data === 'player' ? 'player' : 'dm';
  next();
}
