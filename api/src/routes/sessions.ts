import { Router } from 'express';
import type { Request, Response } from 'express';
import { Session, SessionCreate, SessionUpdate } from '@tabletop/shared';
import { supabaseService } from '../lib/supabaseService.js';
import { getCampaignRole } from '../lib/campaignRole.js';
import { stripDmFields, shouldStripDmFields } from '../lib/stripDmFields.js';
import { HttpError, NotFoundError, sendError } from '../lib/httpErrors.js';
import { createCrudHandlers } from '../lib/crud.js';

export const sessionsRouter = Router();

const handlers = createCrudHandlers({
  table: 'sessions',
  baseSchema: Session,
  createSchema: SessionCreate,
  updateSchema: SessionUpdate,
  responseKey: { single: 'session', plural: 'sessions' },
  resolveCampaignId: (req) => req.params.campaignId,
});

// Custom list handler — sorts by session_number desc
async function listSessions(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) throw new HttpError(500, 'auth middleware missing');

    const campaignId = req.params.campaignId;
    const role = await getCampaignRole(userId, campaignId, supabaseService);
    if (!role) throw new NotFoundError();

    const { data, error } = await supabaseService
      .from('sessions')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('session_number', { ascending: false });
    if (error) throw new HttpError(500, 'database error');

    const rows = (data ?? []).map((r) => Session.parse(r));
    const strip = role === 'player' || shouldStripDmFields(req.requestedView);
    const payload = strip ? rows.map((r) => stripDmFields(r)) : rows;
    res.status(200).json({ sessions: payload });
  } catch (err) {
    sendError(res, err);
  }
}

sessionsRouter.get('/campaigns/:campaignId/sessions', listSessions);
sessionsRouter.post('/campaigns/:campaignId/sessions', handlers.create);
sessionsRouter.get('/campaigns/:campaignId/sessions/:id', handlers.get);
sessionsRouter.patch('/campaigns/:campaignId/sessions/:id', handlers.update);
sessionsRouter.delete('/campaigns/:campaignId/sessions/:id', handlers.remove);
