import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import type { User } from '@supabase/supabase-js';
import { z } from 'zod';

// Stub supabaseService so importing crud/campaignRole doesn't require env vars.
vi.mock('./supabaseService.js', () => ({ supabaseService: {} }));

import { createCrudHandlers, type CrudConfig } from './crud.js';

// ─── Fake entity used throughout these tests ──────────────────────────────────

const Foo = z.object({
  id: z.string(),
  campaign_id: z.string(),
  name: z.string(),
  dm_notes: z.string().optional(),
});
type Foo = z.infer<typeof Foo>;

const FooCreate = Foo.omit({ id: true });
const FooUpdate = FooCreate.partial();

const CAMPAIGN_ID = 'c1';
const USER_ID = 'u1';
const ROW_DM: Foo = { id: 'r1', campaign_id: CAMPAIGN_ID, name: 'Alice', dm_notes: 'secret' };
const ROW_DM_2: Foo = { id: 'r2', campaign_id: CAMPAIGN_ID, name: 'Bob', dm_notes: 'hidden' };

// ─── Mock Supabase query builder ──────────────────────────────────────────────
// The CRUD factory calls `client.from(table).<chain>`. We build a per-test
// dispatcher that returns different chain objects depending on which table is
// being hit (campaign_members vs the entity table).

interface TableMocks {
  selectResult?: { data: unknown; error: unknown };
  singleResult?: { data: unknown; error: unknown };
  maybeSingleResult?: { data: unknown; error: unknown };
  insertSingleResult?: { data: unknown; error: unknown };
  updateSingleResult?: { data: unknown; error: unknown };
  deleteResult?: { data: unknown; error: unknown };
}

function buildTableClient(config: {
  memberRole: 'dm' | 'player' | null;
  foo: TableMocks;
}) {
  const { memberRole, foo } = config;

  const memberQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(
      memberRole === null ? { data: null, error: null } : { data: { role: memberRole }, error: null },
    ),
  };

  // Chain terminal results — the factory's .select('*').eq(...).maybeSingle()
  // for fetchRow and .select('*').eq('campaign_id', ...) for list.
  const listResult = foo.selectResult ?? { data: [], error: null };
  const fetchResult = foo.maybeSingleResult ?? { data: null, error: null };
  const insertResult = foo.insertSingleResult ?? { data: null, error: null };
  const updateResult = foo.updateSingleResult ?? { data: null, error: null };
  const deleteResult = foo.deleteResult ?? { data: null, error: null };

  // The factory's call patterns:
  //   list:   .from(table).select('*').eq('campaign_id', ...) -> awaited directly
  //   get:    .from(table).select('*').eq('id', ...).maybeSingle()
  //   create: .from(table).insert(obj).select('*').single()
  //   update: .from(table).update(obj).eq('id', ...).select('*').single()
  //   delete: .from(table).delete().eq('id', ...)
  // We build a chain that supports all of them, disambiguating list vs get via maybeSingle.

  const fooChain: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    then: (resolve: (v: unknown) => unknown) => Promise<unknown>;
  } = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(fetchResult),
    single: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    // Await behaviour for list (and delete), which await the chain directly.
    then: function (resolve: (v: unknown) => unknown) {
      // If an insert or update has just been called, single() is expected next.
      // list/delete await the chain directly after .eq(). Decide based on which
      // terminal operation has been invoked.
      if (fooChain.delete.mock.calls.length > 0) {
        return Promise.resolve(resolve(deleteResult));
      }
      return Promise.resolve(resolve(listResult));
    },
  };
  // single() is used after insert or update.
  fooChain.single.mockImplementation(() => {
    if (fooChain.insert.mock.calls.length > 0 && fooChain.update.mock.calls.length === 0) {
      return Promise.resolve(insertResult);
    }
    return Promise.resolve(updateResult);
  });

  const from = vi.fn((table: string) => {
    if (table === 'campaign_members') return memberQuery;
    return fooChain;
  });

  const client = { from } as never;
  return { client, from, memberQuery, fooChain };
}

// ─── Request/Response helpers ─────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> & { view?: 'dm' | 'player' } = {}): Request {
  const { view = 'dm', ...rest } = overrides;
  return {
    user: { id: USER_ID } as User,
    requestedView: view,
    params: {},
    query: {},
    body: {},
    ...rest,
  } as unknown as Request;
}

function makeRes() {
  const json = vi.fn().mockReturnThis();
  const end = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json, end });
  return { status, json, end, _status: status, _json: json, _end: end } as unknown as Response & {
    _status: ReturnType<typeof vi.fn>;
    _json: ReturnType<typeof vi.fn>;
    _end: ReturnType<typeof vi.fn>;
  };
}

// Factory-under-test: always uses the same Foo schema; injects the fake client.
function makeHandlers(
  client: ReturnType<typeof buildTableClient>['client'],
  overrides: Partial<CrudConfig<typeof Foo, typeof FooCreate, typeof FooUpdate>> = {},
) {
  return createCrudHandlers({
    table: 'foos',
    baseSchema: Foo,
    createSchema: FooCreate,
    updateSchema: FooUpdate,
    responseKey: { single: 'foo', plural: 'foos' },
    resolveCampaignId: (req, row) =>
      row?.campaign_id ??
      (typeof req.query.campaign_id === 'string' ? req.query.campaign_id : null) ??
      (typeof req.body?.campaign_id === 'string' ? req.body.campaign_id : null),
    supabase: client,
    ...overrides,
  });
}

// ─── list ─────────────────────────────────────────────────────────────────────

describe('createCrudHandlers — list', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('returns rows with dm_ fields intact for DM in DM view', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      foo: { selectResult: { data: [ROW_DM, ROW_DM_2], error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ query: { campaign_id: CAMPAIGN_ID } } as Partial<Request>);
    const res = makeRes();
    await handlers.list(req, res);
    expect(res._status).toHaveBeenCalledWith(200);
    expect(res._json).toHaveBeenCalledWith({ foos: [ROW_DM, ROW_DM_2] });
  });

  it('strips dm_ fields for DM viewing as player', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      foo: { selectResult: { data: [ROW_DM], error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ query: { campaign_id: CAMPAIGN_ID }, view: 'player' } as Partial<Request> & { view: 'player' });
    const res = makeRes();
    await handlers.list(req, res);
    expect(res._json).toHaveBeenCalledWith({
      foos: [{ id: 'r1', campaign_id: CAMPAIGN_ID, name: 'Alice' }],
    });
  });

  it('strips dm_ fields for a player even when they request DM view (no escalation)', async () => {
    const { client } = buildTableClient({
      memberRole: 'player',
      foo: { selectResult: { data: [ROW_DM], error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ query: { campaign_id: CAMPAIGN_ID }, view: 'dm' } as Partial<Request> & { view: 'dm' });
    const res = makeRes();
    await handlers.list(req, res);
    expect(res._json).toHaveBeenCalledWith({
      foos: [{ id: 'r1', campaign_id: CAMPAIGN_ID, name: 'Alice' }],
    });
  });

  it('uses player column list in SELECT when stripping (defense-in-depth)', async () => {
    const { client, fooChain } = buildTableClient({
      memberRole: 'player',
      foo: { selectResult: { data: [ROW_DM], error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ query: { campaign_id: CAMPAIGN_ID }, view: 'dm' } as Partial<Request> & { view: 'dm' });
    const res = makeRes();
    await handlers.list(req, res);
    // The select call should NOT use '*' — it should be the non-dm_ columns only.
    expect(fooChain.select).toHaveBeenCalledWith('id,campaign_id,name');
  });

  it('uses * in SELECT for DM in DM view', async () => {
    const { client, fooChain } = buildTableClient({
      memberRole: 'dm',
      foo: { selectResult: { data: [ROW_DM], error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ query: { campaign_id: CAMPAIGN_ID } } as Partial<Request>);
    const res = makeRes();
    await handlers.list(req, res);
    expect(fooChain.select).toHaveBeenCalledWith('*');
  });

  it('400s when campaign_id cannot be resolved', async () => {
    const { client } = buildTableClient({ memberRole: 'dm', foo: {} });
    const handlers = makeHandlers(client);
    const req = makeReq();
    const res = makeRes();
    await handlers.list(req, res);
    expect(res._status).toHaveBeenCalledWith(400);
    expect(res._json).toHaveBeenCalledWith({
      error: { code: 'VALIDATION_ERROR', message: 'campaign_id required' },
    });
  });

  it('404s when the user has no membership on that campaign', async () => {
    const { client } = buildTableClient({ memberRole: null, foo: {} });
    const handlers = makeHandlers(client);
    const req = makeReq({ query: { campaign_id: CAMPAIGN_ID } } as Partial<Request>);
    const res = makeRes();
    await handlers.list(req, res);
    expect(res._status).toHaveBeenCalledWith(404);
    expect(res._json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'not found' },
    });
  });
});

// ─── get ──────────────────────────────────────────────────────────────────────

describe('createCrudHandlers — get', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('returns the row with dm_ intact for DM in DM view', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      foo: { maybeSingleResult: { data: ROW_DM, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ params: { id: 'r1' } } as Partial<Request>);
    const res = makeRes();
    await handlers.get(req, res);
    expect(res._status).toHaveBeenCalledWith(200);
    expect(res._json).toHaveBeenCalledWith({ foo: ROW_DM });
  });

  it('returns a stripped row for player view', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      foo: { maybeSingleResult: { data: ROW_DM, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ params: { id: 'r1' }, view: 'player' } as Partial<Request> & { view: 'player' });
    const res = makeRes();
    await handlers.get(req, res);
    expect(res._json).toHaveBeenCalledWith({
      foo: { id: 'r1', campaign_id: CAMPAIGN_ID, name: 'Alice' },
    });
  });

  it('404s when the row does not exist', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      foo: { maybeSingleResult: { data: null, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ params: { id: 'nope' } } as Partial<Request>);
    const res = makeRes();
    await handlers.get(req, res);
    expect(res._status).toHaveBeenCalledWith(404);
  });

  it('404s (not 403) when row exists but user is not a member', async () => {
    const { client } = buildTableClient({
      memberRole: null,
      foo: { maybeSingleResult: { data: ROW_DM, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ params: { id: 'r1' } } as Partial<Request>);
    const res = makeRes();
    await handlers.get(req, res);
    expect(res._status).toHaveBeenCalledWith(404);
  });
});

// ─── create ───────────────────────────────────────────────────────────────────

describe('createCrudHandlers — create', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('201s with the inserted row for DM role', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      foo: { insertSingleResult: { data: ROW_DM, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({
      body: { campaign_id: CAMPAIGN_ID, name: 'Alice', dm_notes: 'secret' },
    } as Partial<Request>);
    const res = makeRes();
    await handlers.create(req, res);
    expect(res._status).toHaveBeenCalledWith(201);
    expect(res._json).toHaveBeenCalledWith({ foo: ROW_DM });
  });

  it('strips dm_ fields in the response when DM creates in player view', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      foo: { insertSingleResult: { data: ROW_DM, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({
      body: { campaign_id: CAMPAIGN_ID, name: 'Alice', dm_notes: 'secret' },
      view: 'player',
    } as Partial<Request> & { view: 'player' });
    const res = makeRes();
    await handlers.create(req, res);
    expect(res._status).toHaveBeenCalledWith(201);
    expect(res._json).toHaveBeenCalledWith({
      foo: { id: 'r1', campaign_id: CAMPAIGN_ID, name: 'Alice' },
    });
  });

  it('400s with details on invalid body', async () => {
    const { client } = buildTableClient({ memberRole: 'dm', foo: {} });
    const handlers = makeHandlers(client);
    const req = makeReq({ body: { campaign_id: CAMPAIGN_ID } } as Partial<Request>); // missing name
    const res = makeRes();
    await handlers.create(req, res);
    expect(res._status).toHaveBeenCalledWith(400);
    const body = res._json.mock.calls[0]?.[0] as {
      error: { code: string; message: string; details: unknown };
    };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('invalid body');
    expect(body.error.details).toBeDefined();
  });

  it('403s when the user is a player (not DM)', async () => {
    const { client } = buildTableClient({ memberRole: 'player', foo: {} });
    const handlers = makeHandlers(client);
    const req = makeReq({
      body: { campaign_id: CAMPAIGN_ID, name: 'Alice' },
    } as Partial<Request>);
    const res = makeRes();
    await handlers.create(req, res);
    expect(res._status).toHaveBeenCalledWith(403);
    expect(res._json).toHaveBeenCalledWith({
      error: { code: 'FORBIDDEN', message: 'forbidden' },
    });
  });

  it('forces the authorized campaign_id onto the insert, ignoring any client-supplied value', async () => {
    const authorizedCampaignId = 'c-authorized';
    const { client, fooChain } = buildTableClient({
      memberRole: 'dm',
      foo: {
        insertSingleResult: {
          data: { ...ROW_DM, campaign_id: authorizedCampaignId },
          error: null,
        },
      },
    });
    const handlers = makeHandlers(client, {
      // Simulate an URL-param flow where the authorized campaign is c-authorized,
      // but the body tries to smuggle c-attacker.
      resolveCampaignId: () => authorizedCampaignId,
    });
    const req = makeReq({
      body: { campaign_id: 'c-attacker', name: 'Alice' },
    } as Partial<Request>);
    const res = makeRes();
    await handlers.create(req, res);
    expect(res._status).toHaveBeenCalledWith(201);
    expect(fooChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ campaign_id: authorizedCampaignId, name: 'Alice' }),
    );
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe('createCrudHandlers — update', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('200s with the updated row for DM', async () => {
    const updated = { ...ROW_DM, name: 'Alice-renamed' };
    const { client } = buildTableClient({
      memberRole: 'dm',
      foo: {
        maybeSingleResult: { data: ROW_DM, error: null },
        updateSingleResult: { data: updated, error: null },
      },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({
      params: { id: 'r1' },
      body: { name: 'Alice-renamed' },
    } as Partial<Request>);
    const res = makeRes();
    await handlers.update(req, res);
    expect(res._status).toHaveBeenCalledWith(200);
    expect(res._json).toHaveBeenCalledWith({ foo: updated });
  });

  it('400s on invalid body (wrong field type)', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      foo: { maybeSingleResult: { data: ROW_DM, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ params: { id: 'r1' }, body: { name: 42 } } as Partial<Request>);
    const res = makeRes();
    await handlers.update(req, res);
    expect(res._status).toHaveBeenCalledWith(400);
  });

  it('403s when the user is a player', async () => {
    const { client } = buildTableClient({
      memberRole: 'player',
      foo: { maybeSingleResult: { data: ROW_DM, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ params: { id: 'r1' }, body: { name: 'x' } } as Partial<Request>);
    const res = makeRes();
    await handlers.update(req, res);
    expect(res._status).toHaveBeenCalledWith(403);
  });

  it('404s when the target row is missing', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      foo: { maybeSingleResult: { data: null, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ params: { id: 'nope' }, body: { name: 'x' } } as Partial<Request>);
    const res = makeRes();
    await handlers.update(req, res);
    expect(res._status).toHaveBeenCalledWith(404);
  });

  it('strips campaign_id from the update payload so rows cannot be moved between campaigns', async () => {
    const { client, fooChain } = buildTableClient({
      memberRole: 'dm',
      foo: {
        maybeSingleResult: { data: ROW_DM, error: null },
        updateSingleResult: { data: ROW_DM, error: null },
      },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({
      params: { id: 'r1' },
      body: { campaign_id: 'c-attacker', name: 'renamed' },
    } as Partial<Request>);
    const res = makeRes();
    await handlers.update(req, res);
    expect(res._status).toHaveBeenCalledWith(200);
    const updateArg = fooChain.update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateArg).toEqual({ name: 'renamed' });
    expect(updateArg).not.toHaveProperty('campaign_id');
  });
});

// ─── remove ───────────────────────────────────────────────────────────────────

describe('createCrudHandlers — remove', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('204s for DM', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      foo: {
        maybeSingleResult: { data: ROW_DM, error: null },
        deleteResult: { data: null, error: null },
      },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ params: { id: 'r1' } } as Partial<Request>);
    const res = makeRes();
    await handlers.remove(req, res);
    expect(res._status).toHaveBeenCalledWith(204);
    expect(res._end).toHaveBeenCalled();
  });

  it('403s for player', async () => {
    const { client } = buildTableClient({
      memberRole: 'player',
      foo: { maybeSingleResult: { data: ROW_DM, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ params: { id: 'r1' } } as Partial<Request>);
    const res = makeRes();
    await handlers.remove(req, res);
    expect(res._status).toHaveBeenCalledWith(403);
  });

  it('404s when the row is missing', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      foo: { maybeSingleResult: { data: null, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ params: { id: 'nope' } } as Partial<Request>);
    const res = makeRes();
    await handlers.remove(req, res);
    expect(res._status).toHaveBeenCalledWith(404);
  });
});

// ─── null → undefined coercion ────────────────────────────────────────────────

describe('createCrudHandlers — Postgres null handling', () => {
  // z.string().optional() rejects `null` — but that's what PostgREST returns
  // for unset nullable columns. The factory must coerce these so every caller
  // doesn't duplicate the fix.
  const FooWithOptional = z.object({
    id: z.string(),
    campaign_id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    dm_notes: z.string().optional(),
  });
  type FooWithOptional = z.infer<typeof FooWithOptional>;
  const FooWithOptionalCreate = FooWithOptional.omit({ id: true });

  const ROW_WITH_NULLS = {
    id: 'r1',
    campaign_id: CAMPAIGN_ID,
    name: 'Alice',
    description: null,
    dm_notes: null,
  };

  it('list: coerces nulls in returned rows before Zod parse', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      foo: { selectResult: { data: [ROW_WITH_NULLS], error: null } },
    });
    const handlers = createCrudHandlers({
      table: 'foos',
      baseSchema: FooWithOptional,
      createSchema: FooWithOptionalCreate,
      updateSchema: FooWithOptionalCreate.partial(),
      responseKey: { single: 'foo', plural: 'foos' },
      resolveCampaignId: () => CAMPAIGN_ID,
      supabase: client,
    });

    const req = makeReq();
    const res = makeRes();
    await handlers.list(req, res);

    expect(res._status).toHaveBeenCalledWith(200);
    const body = res._json.mock.calls[0][0] as { foos: FooWithOptional[] };
    expect(body.foos[0].description).toBeUndefined();
  });

  it('get: coerces nulls on single-row read', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      foo: { maybeSingleResult: { data: ROW_WITH_NULLS, error: null } },
    });
    const handlers = createCrudHandlers({
      table: 'foos',
      baseSchema: FooWithOptional,
      createSchema: FooWithOptionalCreate,
      updateSchema: FooWithOptionalCreate.partial(),
      responseKey: { single: 'foo', plural: 'foos' },
      resolveCampaignId: () => CAMPAIGN_ID,
      supabase: client,
    });

    const req = makeReq({ params: { id: 'r1' } } as Partial<Request>);
    const res = makeRes();
    await handlers.get(req, res);

    expect(res._status).toHaveBeenCalledWith(200);
    const body = res._json.mock.calls[0][0] as { foo: FooWithOptional };
    expect(body.foo.description).toBeUndefined();
  });
});

// ─── response wrapper key ─────────────────────────────────────────────────────

describe('createCrudHandlers — response wrapper keys', () => {
  it('honours custom single/plural keys', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      foo: {
        selectResult: { data: [ROW_DM], error: null },
        maybeSingleResult: { data: ROW_DM, error: null },
      },
    });
    const handlers = makeHandlers(client, {
      responseKey: { single: 'lore', plural: 'lore' },
    });

    const listReq = makeReq({ query: { campaign_id: CAMPAIGN_ID } } as Partial<Request>);
    const listRes = makeRes();
    await handlers.list(listReq, listRes);
    expect(listRes._json).toHaveBeenCalledWith({ lore: [ROW_DM] });

    const getReq = makeReq({ params: { id: 'r1' } } as Partial<Request>);
    const getRes = makeRes();
    await handlers.get(getReq, getRes);
    expect(getRes._json).toHaveBeenCalledWith({ lore: ROW_DM });
  });
});
