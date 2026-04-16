import { Router } from 'express';
import { ConfigResponse } from '@tabletop/shared';

export const configRouter = Router();

configRouter.get('/config', (_req, res) => {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    res.status(500).json({ error: 'supabase not configured' });
    return;
  }
  const body = ConfigResponse.parse({ supabase: { url, anonKey } });
  res.json(body);
});
