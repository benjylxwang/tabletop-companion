import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase.js';

const BEARER_PREFIX = 'Bearer ';

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header('authorization') ?? req.header('Authorization');

  if (!header || !header.startsWith(BEARER_PREFIX)) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
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
