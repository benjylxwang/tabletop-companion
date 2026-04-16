import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase.js';

const BEARER_HEADER = /^bearer\s+(.+)$/i;

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.header('authorization')?.match(BEARER_HEADER)?.[1]?.trim();
  if (!token) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }

  req.user = data.user;
  next();
}
