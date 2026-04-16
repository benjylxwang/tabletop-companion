import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { User } from '@supabase/supabase-js';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFrom = vi.fn();

vi.mock('../lib/supabaseService.js', () => ({
  supabaseService: { from: (...args: unknown[]) => mockFrom(...args) },
}));

const mockGetCampaignRole = vi.fn();

vi.mock('../lib/campaignRole.js', () => ({
  getCampaignRole: (...args: unknown[]) => mockGetCampaignRole(...args),
}));

// Dynamic import must come AFTER mocks are registered
const { loreRouter } = await import('./lore.js');

// ─── Chain builder ────────────────────────────────────────────────────────────

type DBResult = { data: unknown; error: unknown };

function makeChain(directResult: DBResult, singleResult?: DBResult) {
  const single = singleResult ?? directResult;
  const self: Record<string, unknown> = {
    select: vi.fn(() => self),
    eq: vi.fn(() => self),
    insert: vi.fn(() => self),
    update: vi.fn(() => self),
    delete: vi.fn(() => self),
    order: vi.fn(() => self),
    maybeSingle: vi.fn(() => Promise.resolve(single)),
    single: vi.fn(() => Promise.resolve(single)),
    then: (
      resolve: (v: DBResult) => void,
      reject?: (e: unknown) => void,
    ) => Promise.resolve(directResult).then(resolve, reject),
  };
  return self;
}

// ─── Request / Response helpers ───────────────────────────────────────────────

const FAKE_USER: User = { id: 'user-1', email: 'dm@test.com' } as unknown as User;

const FAKE_LORE_PUBLIC = {
  id: 'lore-1',
  campaign_id: 'camp-1',
  title: 'The Age of Dragons',
  category: 'History',
  content: 'Long ago, dragons ruled the skies.',
  visibility: 'Public',
  dm_notes: 'secret context',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  revealed_to: null,
} as const;

const FAKE_LORE_PRIVATE = {
  ...FAKE_LORE_PUBLIC,
  id: 'lore-2',
  title: 'Hidden Plot',
  visibility: 'Private',
} as const;

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    user: FAKE_USER,
    requestedView: 'dm',
    params: { campaignId: 'camp-1' },
    body: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const json = vi.fn().mockReturnThis();
  const end = vi.fn();
  const status = vi.fn().mockReturnValue({ json, end });
  return {
    json,
    status,
    end,
    _json: json,
    _status: status,
  } as unknown as Response & {
    _json: typeof json;
    _status: typeof status;
  };
}

// Get the route handler for a given method + path
function getHandler(method: string, path: string) {
  const layer = (loreRouter.stack as Array<{
    route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: unknown }> };
  }>).find(
    (l) =>
      l.route?.path === path &&
      l.route.methods[method.toLowerCase()],
  );
  if (!layer?.route) throw new Error(`No handler for ${method} ${path}`);
  const handle = layer.route.stack[layer.route.stack.length - 1].handle;
  return handle as (req: Request, res: Response) => Promise<void>;
}

// ─── GET /campaigns/:campaignId/lore ─────────────────────────────────────────

describe('GET /campaigns/:campaignId/lore', () => {
  const handler = getHandler('get', '/campaigns/:campaignId/lore');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
  });

  it('returns all lore entries for DM view', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockFrom.mockReturnValue(
      makeChain({ data: [FAKE_LORE_PUBLIC, FAKE_LORE_PRIVATE], error: null }),
    );

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    expect(res._json).toHaveBeenCalledOnce();
    const body = (res._json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.lore).toHaveLength(2);
    expect(body.lore[0].dm_notes).toBe('secret context');
  });

  it('row-filters Private entries for player view', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    // Only public entry returned — row-filter applied at DB query level
    mockFrom.mockReturnValue(
      makeChain({ data: [FAKE_LORE_PUBLIC], error: null }),
    );

    const req = makeReq({ requestedView: 'player' });
    const res = makeRes();
    await handler(req, res);

    const body = (res._json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.lore).toHaveLength(1);
    expect(body.lore[0].id).toBe('lore-1');

    // Verify .eq('visibility', 'Public') was called on the chain
    const chain = mockFrom.mock.results[0].value as Record<string, ReturnType<typeof vi.fn>>;
    const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
    expect(eqCalls).toContainEqual(['visibility', 'Public']);
  });

  it('strips dm_notes from public entries in player view', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockFrom.mockReturnValue(
      makeChain({ data: [FAKE_LORE_PUBLIC], error: null }),
    );

    const req = makeReq({ requestedView: 'player' });
    const res = makeRes();
    await handler(req, res);

    const body = (res._json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.lore[0].dm_notes).toBeUndefined();
  });

  it('returns 404 when user is not a campaign member', async () => {
    mockGetCampaignRole.mockResolvedValue(null);

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on database error', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'db error' } }));

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(500);
  });
});

// ─── POST /campaigns/:campaignId/lore ────────────────────────────────────────

describe('POST /campaigns/:campaignId/lore', () => {
  const handler = getHandler('post', '/campaigns/:campaignId/lore');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
  });

  it('creates a lore entry and returns 201', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: null }, { data: FAKE_LORE_PUBLIC, error: null }),
    );

    const req = makeReq({
      body: {
        title: 'The Age of Dragons',
        category: 'History',
        content: 'Long ago, dragons ruled the skies.',
        visibility: 'Public',
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(201);
    const body = (res._status as ReturnType<typeof vi.fn>).mock.results[0].value.json.mock.calls[0][0];
    expect(body.lore.title).toBe('The Age of Dragons');
  });

  it('returns 400 for missing required title', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');

    const req = makeReq({ body: { category: 'History', visibility: 'Public' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for invalid category', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');

    const req = makeReq({
      body: { title: 'Test', category: 'InvalidCat', visibility: 'Public' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(400);
  });

  it('returns 403 when player tries to create', async () => {
    mockGetCampaignRole.mockResolvedValue('player');

    const req = makeReq({
      body: { title: 'Test', category: 'History', visibility: 'Public' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(403);
  });

  it('returns 404 when non-member tries to create', async () => {
    mockGetCampaignRole.mockResolvedValue(null);

    const req = makeReq({
      body: { title: 'Test', category: 'History', visibility: 'Public' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });
});

// ─── GET /campaigns/:campaignId/lore/:loreId ─────────────────────────────────

describe('GET /campaigns/:campaignId/lore/:loreId', () => {
  const handler = getHandler('get', '/campaigns/:campaignId/lore/:loreId');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
  });

  it('returns a lore entry for DM', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: null }, { data: FAKE_LORE_PUBLIC, error: null }),
    );

    const req = makeReq({ params: { campaignId: 'camp-1', loreId: 'lore-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._json).toHaveBeenCalledOnce();
    const body = (res._json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.lore.title).toBe('The Age of Dragons');
    expect(body.lore.dm_notes).toBe('secret context');
  });

  it('returns Private entry for DM view', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: null }, { data: FAKE_LORE_PRIVATE, error: null }),
    );

    const req = makeReq({ params: { campaignId: 'camp-1', loreId: 'lore-2' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._json).toHaveBeenCalledOnce();
    const body = (res._json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.lore.visibility).toBe('Private');
  });

  it('returns 404 for Private entry in player view', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: null }, { data: FAKE_LORE_PRIVATE, error: null }),
    );

    const req = makeReq({
      requestedView: 'player',
      params: { campaignId: 'camp-1', loreId: 'lore-2' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });

  it('strips dm_notes from Public entry in player view', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: null }, { data: FAKE_LORE_PUBLIC, error: null }),
    );

    const req = makeReq({
      requestedView: 'player',
      params: { campaignId: 'camp-1', loreId: 'lore-1' },
    });
    const res = makeRes();
    await handler(req, res);

    const body = (res._json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.lore.dm_notes).toBeUndefined();
  });

  it('returns 404 when lore entry not found', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: null }, { data: null, error: null }),
    );

    const req = makeReq({ params: { campaignId: 'camp-1', loreId: 'nonexistent' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });
});

// ─── PUT /campaigns/:campaignId/lore/:loreId ─────────────────────────────────

describe('PUT /campaigns/:campaignId/lore/:loreId', () => {
  const handler = getHandler('put', '/campaigns/:campaignId/lore/:loreId');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
  });

  it('updates a lore entry and returns it', async () => {
    const updated = { ...FAKE_LORE_PUBLIC, title: 'Updated Title' };
    // First call: select existing; second call: update
    mockFrom
      .mockReturnValueOnce(
        makeChain({ data: null, error: null }, { data: { id: 'lore-1' }, error: null }),
      )
      .mockReturnValueOnce(
        makeChain({ data: null, error: null }, { data: updated, error: null }),
      );
    mockGetCampaignRole.mockResolvedValue('dm');

    const req = makeReq({
      params: { campaignId: 'camp-1', loreId: 'lore-1' },
      body: { title: 'Updated Title' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res._json).toHaveBeenCalledOnce();
    const body = (res._json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.lore.title).toBe('Updated Title');
  });

  it('returns 403 when player tries to update', async () => {
    mockFrom.mockReturnValueOnce(
      makeChain({ data: null, error: null }, { data: { id: 'lore-1' }, error: null }),
    );
    mockGetCampaignRole.mockResolvedValue('player');

    const req = makeReq({
      params: { campaignId: 'camp-1', loreId: 'lore-1' },
      body: { title: 'Sneaky Edit' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(403);
  });

  it('returns 404 when lore entry not found', async () => {
    mockFrom.mockReturnValueOnce(
      makeChain({ data: null, error: null }, { data: null, error: null }),
    );

    const req = makeReq({
      params: { campaignId: 'camp-1', loreId: 'nonexistent' },
      body: { title: 'Edit' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });
});

// ─── DELETE /campaigns/:campaignId/lore/:loreId ──────────────────────────────

describe('DELETE /campaigns/:campaignId/lore/:loreId', () => {
  const handler = getHandler('delete', '/campaigns/:campaignId/lore/:loreId');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
  });

  it('deletes a lore entry and returns 204', async () => {
    mockFrom
      .mockReturnValueOnce(
        makeChain({ data: null, error: null }, { data: { id: 'lore-1' }, error: null }),
      )
      .mockReturnValueOnce(makeChain({ data: null, error: null }));
    mockGetCampaignRole.mockResolvedValue('dm');

    const req = makeReq({ params: { campaignId: 'camp-1', loreId: 'lore-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(204);
  });

  it('returns 403 when player tries to delete', async () => {
    mockFrom.mockReturnValueOnce(
      makeChain({ data: null, error: null }, { data: { id: 'lore-1' }, error: null }),
    );
    mockGetCampaignRole.mockResolvedValue('player');

    const req = makeReq({ params: { campaignId: 'camp-1', loreId: 'lore-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(403);
  });

  it('returns 404 when lore entry not found', async () => {
    mockFrom.mockReturnValueOnce(
      makeChain({ data: null, error: null }, { data: null, error: null }),
    );

    const req = makeReq({ params: { campaignId: 'camp-1', loreId: 'nonexistent' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });
});
