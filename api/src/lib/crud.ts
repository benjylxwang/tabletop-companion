import type { Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tabletop/shared';
import { z, type ZodTypeAny } from 'zod';
import { supabaseService } from './supabaseService.js';
import { getCampaignRole, type CampaignRole } from './campaignRole.js';
import { stripDmFields, shouldStripDmFields } from './stripDmFields.js';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  HttpError,
  sendError,
} from './httpErrors.js';

// The factory is table-generic, so we can't statically preserve the
// Database-typed table overloads from the Supabase client. We read through
// this untyped view and validate returned rows against the provided Zod
// schema — that's the source of truth at runtime.
type UntypedSupabase = SupabaseClient;

type Row = Record<string, unknown>;

type ResolveCampaignId<TBase extends ZodTypeAny> = (
  req: Request,
  row?: z.infer<TBase>,
) => string | null | Promise<string | null>;

export interface CrudConfig<
  TBase extends ZodTypeAny,
  TCreate extends ZodTypeAny,
  TUpdate extends ZodTypeAny,
> {
  table: string;
  baseSchema: TBase;
  createSchema: TCreate;
  updateSchema: TUpdate;
  responseKey: { single: string; plural: string };
  resolveCampaignId: ResolveCampaignId<TBase>;
  supabase?: SupabaseClient<Database>;
}

export interface CrudHandlers {
  list: (req: Request, res: Response) => Promise<void>;
  get: (req: Request, res: Response) => Promise<void>;
  create: (req: Request, res: Response) => Promise<void>;
  update: (req: Request, res: Response) => Promise<void>;
  remove: (req: Request, res: Response) => Promise<void>;
}

export function createCrudHandlers<
  TBase extends ZodTypeAny,
  TCreate extends ZodTypeAny,
  TUpdate extends ZodTypeAny,
>(config: CrudConfig<TBase, TCreate, TUpdate>): CrudHandlers {
  const client: UntypedSupabase = (config.supabase ?? supabaseService) as UntypedSupabase;
  const { table, baseSchema, createSchema, updateSchema, responseKey } = config;

  function requireUser(req: Request): string {
    const id = req.user?.id;
    if (!id) {
      throw new HttpError(500, 'auth middleware missing');
    }
    return id;
  }

  async function resolveCampaignIdRequired(
    req: Request,
    row?: z.infer<TBase>,
  ): Promise<string> {
    const campaignId = await config.resolveCampaignId(req, row);
    if (!campaignId) {
      throw new ValidationError('campaign_id required');
    }
    return campaignId;
  }

  async function requireRole(userId: string, campaignId: string): Promise<CampaignRole> {
    const role = await getCampaignRole(userId, campaignId, client);
    if (!role) throw new NotFoundError();
    return role;
  }

  function shouldStrip(role: CampaignRole, req: Request): boolean {
    return role === 'player' || shouldStripDmFields(req.requestedView);
  }

  async function fetchRow(id: string): Promise<z.infer<TBase>> {
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new HttpError(500, 'database error');
    }
    if (!data) throw new NotFoundError();
    return baseSchema.parse(data) as z.infer<TBase>;
  }

  async function list(req: Request, res: Response): Promise<void> {
    try {
      const userId = requireUser(req);
      const campaignId = await resolveCampaignIdRequired(req);
      const role = await requireRole(userId, campaignId);

      const { data, error } = await client
        .from(table)
        .select('*')
        .eq('campaign_id', campaignId);
      if (error) throw new HttpError(500, 'database error');

      const rows = (data ?? []).map((r) => baseSchema.parse(r) as z.infer<TBase>);
      const payload = shouldStrip(role, req) ? rows.map((r) => stripDmFields(r)) : rows;
      res.status(200).json({ [responseKey.plural]: payload });
    } catch (err) {
      sendError(res, err);
    }
  }

  async function get(req: Request, res: Response): Promise<void> {
    try {
      const userId = requireUser(req);
      const row = await fetchRow(req.params.id);
      const campaignId = await resolveCampaignIdRequired(req, row);
      const role = await requireRole(userId, campaignId);

      const payload = shouldStrip(role, req) ? stripDmFields(row) : row;
      res.status(200).json({ [responseKey.single]: payload });
    } catch (err) {
      sendError(res, err);
    }
  }

  async function create(req: Request, res: Response): Promise<void> {
    try {
      const userId = requireUser(req);
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('invalid body', parsed.error.flatten());
      }

      const campaignId = await resolveCampaignIdRequired(req);
      const role = await requireRole(userId, campaignId);
      if (role !== 'dm') throw new ForbiddenError();

      // Bind the row to the authorized campaign. Never trust a client-supplied
      // campaign_id on the insert — the authorized campaignId (from URL, etc.)
      // is the only source of truth for placement.
      const insertRow = { ...(parsed.data as Row), campaign_id: campaignId };

      const { data, error } = await client
        .from(table)
        .insert(insertRow)
        .select('*')
        .single();
      if (error || !data) throw new HttpError(500, 'database error');

      const row = baseSchema.parse(data) as z.infer<TBase>;
      const payload = shouldStrip(role, req) ? stripDmFields(row) : row;
      res.status(201).json({ [responseKey.single]: payload });
    } catch (err) {
      sendError(res, err);
    }
  }

  async function update(req: Request, res: Response): Promise<void> {
    try {
      const userId = requireUser(req);
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('invalid body', parsed.error.flatten());
      }

      const existing = await fetchRow(req.params.id);
      const campaignId = await resolveCampaignIdRequired(req, existing);
      const role = await requireRole(userId, campaignId);
      if (role !== 'dm') throw new ForbiddenError();

      // Never allow a row to be moved across campaigns via PATCH — that would
      // let a DM on campaign A push rows into campaign B. Strip campaign_id
      // unconditionally; it's pinned at create time.
      const { campaign_id: _ignored, ...updatePayload } = parsed.data as Row;

      const { data, error } = await client
        .from(table)
        .update(updatePayload)
        .eq('id', req.params.id)
        .select('*')
        .single();
      if (error || !data) throw new HttpError(500, 'database error');

      const row = baseSchema.parse(data) as z.infer<TBase>;
      const payload = shouldStrip(role, req) ? stripDmFields(row) : row;
      res.status(200).json({ [responseKey.single]: payload });
    } catch (err) {
      sendError(res, err);
    }
  }

  async function remove(req: Request, res: Response): Promise<void> {
    try {
      const userId = requireUser(req);
      const existing = await fetchRow(req.params.id);
      const campaignId = await resolveCampaignIdRequired(req, existing);
      const role = await requireRole(userId, campaignId);
      if (role !== 'dm') throw new ForbiddenError();

      const { error } = await client.from(table).delete().eq('id', req.params.id);
      if (error) throw new HttpError(500, 'database error');

      res.status(204).end();
    } catch (err) {
      sendError(res, err);
    }
  }

  return { list, get, create, update, remove };
}
