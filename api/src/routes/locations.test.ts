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

const { locationsRouter } = await import('./locations.js');

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

// Simulate a real Postgres row: nulls for unset optional columns.
const FAKE_LOCATION = {
  id: 'loc-1',
  campaign_id: 'camp-1',
  name: 'Phandalin',
  type: 'Town',
  description: null,
  history: null,
  map_image_url: null,
  parent_location_id: null,
  dm_notes: 'secret town council',
  created_at: '2026-01-01T00:00:00.000Z',
} as const;

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    user: FAKE_USER,
    requestedView: 'dm',
    params: {},
    body: {},
    query: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const json = vi.fn().mockReturnThis();
  const end = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json, end });
  return { json, status, end, _json: json, _status: status, _end: end } as unknown as Response & {
    _json: typeof json;
    _status: typeof status;
    _end: typeof end;
  };
}

function getHandler(method: string, path: string) {
  const layer = (locationsRouter.stack as Array<{
    route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: unknown }> };
  }>).find(
    (l) => l.route?.path === path && l.route.methods[method.toLowerCase()],
  );
  if (!layer?.route) throw new Error(`No handler for ${method} ${path}`);
  const handle = layer.route.stack[layer.route.stack.length - 1].handle;
  return handle as (req: Request, res: Response) => Promise<void>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /campaigns/:campaignId/locations', () => {
  const handler = getHandler('get', '/campaigns/:campaignId/locations');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
    mockGetCampaignRole.mockResolvedValue('dm');
  });

  it('lists locations in the campaign', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [FAKE_LOCATION], error: null }));

    const req = makeReq({ params: { campaignId: 'camp-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(200);
    const body = res._json.mock.calls[0][0] as { locations: { name: string }[] };
    expect(body.locations).toHaveLength(1);
    expect(body.locations[0].name).toBe('Phandalin');
  });

  it('strips dm_notes in player view', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [FAKE_LOCATION], error: null }));

    const req = makeReq({ params: { campaignId: 'camp-1' }, requestedView: 'player' });
    const res = makeRes();
    await handler(req, res);

    const body = res._json.mock.calls[0][0] as { locations: Array<Record<string, unknown>> };
    expect(body.locations[0].dm_notes).toBeUndefined();
  });

  it('strips dm_notes for player role even in DM view', async () => {
    mockGetCampaignRole.mockResolvedValue('player');
    mockFrom.mockReturnValue(makeChain({ data: [FAKE_LOCATION], error: null }));

    const req = makeReq({ params: { campaignId: 'camp-1' } });
    const res = makeRes();
    await handler(req, res);

    const body = res._json.mock.calls[0][0] as { locations: Array<Record<string, unknown>> };
    expect(body.locations[0].dm_notes).toBeUndefined();
  });

  it('returns 404 when the user is not a member of the campaign', async () => {
    mockGetCampaignRole.mockResolvedValue(null);

    const req = makeReq({ params: { campaignId: 'camp-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });
});

describe('POST /campaigns/:campaignId/locations', () => {
  const handler = getHandler('post', '/campaigns/:campaignId/locations');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
    mockGetCampaignRole.mockResolvedValue('dm');
  });

  it('creates a location bound to the URL campaign (ignoring body campaign_id)', async () => {
    const chain = makeChain({ data: null, error: null }, { data: FAKE_LOCATION, error: null });
    mockFrom.mockReturnValue(chain);

    const req = makeReq({
      params: { campaignId: 'camp-1' },
      body: { campaign_id: 'c-attacker', name: 'Phandalin', type: 'Town' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(201);
    // The insert was called — the body's smuggled campaign_id is not in the
    // create schema at all, so it would have been rejected by Zod if accepted.
    // Confirm server-side override: the insert row is bound to camp-1.
    const insertArg = (chain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.campaign_id).toBe('camp-1');
    expect(insertArg.name).toBe('Phandalin');
  });

  it('rejects invalid body (missing name)', async () => {
    const req = makeReq({ params: { campaignId: 'camp-1' }, body: { type: 'Town' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(400);
  });

  it('returns 403 for a player', async () => {
    mockGetCampaignRole.mockResolvedValue('player');

    const req = makeReq({ params: { campaignId: 'camp-1' }, body: { name: 'Phandalin' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(403);
  });

  it('returns 404 for a non-member', async () => {
    mockGetCampaignRole.mockResolvedValue(null);

    const req = makeReq({ params: { campaignId: 'camp-1' }, body: { name: 'Phandalin' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });
});

describe('GET /campaigns/:campaignId/locations/:id', () => {
  const handler = getHandler('get', '/campaigns/:campaignId/locations/:id');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
    mockGetCampaignRole.mockResolvedValue('dm');
  });

  it('returns the location with dm_notes for the DM', async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: null }, { data: FAKE_LOCATION, error: null }),
    );

    const req = makeReq({ params: { campaignId: 'camp-1', id: 'loc-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(200);
    const body = res._json.mock.calls[0][0] as { location: Record<string, unknown> };
    expect(body.location.id).toBe('loc-1');
    expect(body.location.dm_notes).toBe('secret town council');
  });

  it('strips dm_notes in player view', async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: null }, { data: FAKE_LOCATION, error: null }),
    );

    const req = makeReq({
      params: { campaignId: 'camp-1', id: 'loc-1' },
      requestedView: 'player',
    });
    const res = makeRes();
    await handler(req, res);

    const body = res._json.mock.calls[0][0] as { location: Record<string, unknown> };
    expect(body.location.dm_notes).toBeUndefined();
  });

  it('returns 404 when the row does not exist', async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: null }, { data: null, error: null }),
    );

    const req = makeReq({ params: { campaignId: 'camp-1', id: 'nope' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });
});

describe('PUT /campaigns/:campaignId/locations/:id', () => {
  const handler = getHandler('put', '/campaigns/:campaignId/locations/:id');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
    mockGetCampaignRole.mockResolvedValue('dm');
  });

  it('updates the location for the DM', async () => {
    const updated = { ...FAKE_LOCATION, name: 'Phandalin (restored)' };
    // fetchRow is called first (select/eq/maybeSingle), then update (update/eq/select/single).
    // Both hit the same table through chains — reuse one builder.
    const chain = makeChain(
      { data: null, error: null },
      { data: FAKE_LOCATION, error: null },
    );
    mockFrom.mockReturnValueOnce(chain); // fetchRow
    const updateChain = makeChain(
      { data: null, error: null },
      { data: updated, error: null },
    );
    mockFrom.mockReturnValueOnce(updateChain); // update

    const req = makeReq({
      params: { campaignId: 'camp-1', id: 'loc-1' },
      body: { name: 'Phandalin (restored)' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(200);
    const body = res._json.mock.calls[0][0] as { location: { name: string } };
    expect(body.location.name).toBe('Phandalin (restored)');
  });

  it('returns 403 for a player', async () => {
    mockGetCampaignRole.mockResolvedValue('player');
    mockFrom.mockReturnValueOnce(
      makeChain({ data: null, error: null }, { data: FAKE_LOCATION, error: null }),
    );

    const req = makeReq({
      params: { campaignId: 'camp-1', id: 'loc-1' },
      body: { name: 'new' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(403);
  });
});

describe('DELETE /campaigns/:campaignId/locations/:id', () => {
  const handler = getHandler('delete', '/campaigns/:campaignId/locations/:id');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
    mockGetCampaignRole.mockResolvedValue('dm');
  });

  it('deletes and returns 204 for DM', async () => {
    mockFrom.mockReturnValueOnce(
      makeChain({ data: null, error: null }, { data: FAKE_LOCATION, error: null }),
    );
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));

    const req = makeReq({ params: { campaignId: 'camp-1', id: 'loc-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(204);
  });

  it('returns 403 for a player', async () => {
    mockGetCampaignRole.mockResolvedValue('player');
    mockFrom.mockReturnValueOnce(
      makeChain({ data: null, error: null }, { data: FAKE_LOCATION, error: null }),
    );

    const req = makeReq({ params: { campaignId: 'camp-1', id: 'loc-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(403);
  });
});
