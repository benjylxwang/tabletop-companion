import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { User } from '@supabase/supabase-js';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockGetUserByEmail = vi.fn();

vi.mock('../lib/supabaseService.js', () => ({
  supabaseService: { from: (...args: unknown[]) => mockFrom(...args) },
  getUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args),
}));

const mockGetCampaignRole = vi.fn();

vi.mock('../lib/campaignRole.js', () => ({
  getCampaignRole: (...args: unknown[]) => mockGetCampaignRole(...args),
}));

// Dynamic import must come AFTER mocks are registered
const { campaignsRouter } = await import('./campaigns.js');

// ─── Chain builder ────────────────────────────────────────────────────────────
// Builds a fake Supabase query chain that is:
//   - directly awaitable (via .then) → returns `directResult`
//   - or terminates with .maybeSingle() / .single() → returns `singleResult`

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

// Simulate what Supabase actually returns: nulls for unset optional fields
const FAKE_CAMPAIGN = {
  id: 'camp-1',
  name: 'Lost Mine',
  system: 'D&D 5e',
  description: null,
  cover_image_url: null,
  status: 'Active',
  dm_notes: 'secret',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
} as const;

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    user: FAKE_USER,
    requestedView: 'dm',
    params: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const json = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json, end: vi.fn() });
  const end = vi.fn();
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

// Get the route handler for a given method + path from the router
function getHandler(method: string, path: string) {
  const layer = (campaignsRouter.stack as Array<{
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /campaigns', () => {
  const handler = getHandler('get', '/campaigns');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
  });

  it('returns campaigns for the user', async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: [{ role: 'dm', campaigns: FAKE_CAMPAIGN }], error: null }),
    );

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    expect(res._json).toHaveBeenCalledOnce();
    const body = (res._json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.campaigns).toHaveLength(1);
    expect(body.campaigns[0].name).toBe('Lost Mine');
    expect(body.campaigns[0].my_role).toBe('dm');
  });

  it('returns empty array when user has no campaigns', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }));

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    const body = (res._json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.campaigns).toHaveLength(0);
  });

  it('strips dm_notes for player view', async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: [{ role: 'player', campaigns: FAKE_CAMPAIGN }], error: null }),
    );

    const req = makeReq({ requestedView: 'player' });
    const res = makeRes();
    await handler(req, res);

    const body = (res._json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.campaigns[0].dm_notes).toBeUndefined();
  });

  it('returns 500 on database error', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'db error' } }));

    const req = makeReq();
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(500);
  });
});

describe('POST /campaigns', () => {
  const handler = getHandler('post', '/campaigns');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
  });

  it('creates a campaign and adds DM member', async () => {
    // First call: campaigns.insert → returns campaign
    // Second call: campaign_members.insert → returns success
    mockFrom
      .mockReturnValueOnce(makeChain({ data: null, error: null }, { data: FAKE_CAMPAIGN, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }));

    const req = makeReq({ body: { name: 'Lost Mine', status: 'Active' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(201);
    const body = (res._status as ReturnType<typeof vi.fn>).mock.results[0].value.json.mock.calls[0][0];
    expect(body.campaign.name).toBe('Lost Mine');
    expect(body.campaign.my_role).toBe('dm');
  });

  it('returns 400 for invalid body', async () => {
    const req = makeReq({ body: {} }); // missing required `name`
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(400);
  });

  it('returns 500 if campaign insert fails', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: null }, { data: null, error: { message: 'db error' } }));

    const req = makeReq({ body: { name: 'Lost Mine', status: 'Active' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(500);
  });

  it('cleans up campaign and returns 500 if member insert fails', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ data: null, error: null }, { data: FAKE_CAMPAIGN, error: null })) // campaigns insert
      .mockReturnValueOnce(makeChain({ data: null, error: { message: 'member error' } })) // campaign_members insert
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // cleanup delete

    const req = makeReq({ body: { name: 'Lost Mine', status: 'Active' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(500);
    // Cleanup delete was called
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });
});

describe('GET /campaigns/:id', () => {
  const handler = getHandler('get', '/campaigns/:id');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
  });

  it('returns the campaign for a member', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }, { data: FAKE_CAMPAIGN, error: null }));
    mockGetCampaignRole.mockResolvedValue('dm');

    const req = makeReq({ params: { id: 'camp-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._json).toHaveBeenCalledOnce();
    const body = (res._json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.campaign.id).toBe('camp-1');
    expect(body.campaign.my_role).toBe('dm');
  });

  it('returns 404 if campaign does not exist', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }, { data: null, error: null }));

    const req = makeReq({ params: { id: 'camp-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });

  it('returns 404 if user is not a member', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }, { data: FAKE_CAMPAIGN, error: null }));
    mockGetCampaignRole.mockResolvedValue(null);

    const req = makeReq({ params: { id: 'camp-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });

  it('strips dm_notes for player view', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }, { data: FAKE_CAMPAIGN, error: null }));
    mockGetCampaignRole.mockResolvedValue('player');

    const req = makeReq({ params: { id: 'camp-1' }, requestedView: 'player' });
    const res = makeRes();
    await handler(req, res);

    const body = (res._json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.campaign.dm_notes).toBeUndefined();
  });
});

describe('PUT /campaigns/:id', () => {
  const handler = getHandler('put', '/campaigns/:id');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
  });

  const UPDATED = { ...FAKE_CAMPAIGN, name: 'Updated Name' };

  it('updates the campaign for a DM', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ data: null, error: null }, { data: FAKE_CAMPAIGN, error: null })) // fetch existing
      .mockReturnValueOnce(makeChain({ data: null, error: null }, { data: UPDATED, error: null })); // update
    mockGetCampaignRole.mockResolvedValue('dm');

    const req = makeReq({ params: { id: 'camp-1' }, body: { name: 'Updated Name' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._json).toHaveBeenCalledOnce();
    const body = (res._json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.campaign.name).toBe('Updated Name');
  });

  it('returns 403 for a player', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: null }, { data: FAKE_CAMPAIGN, error: null }));
    mockGetCampaignRole.mockResolvedValue('player');

    const req = makeReq({ params: { id: 'camp-1' }, body: { name: 'Updated Name' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(403);
  });

  it('returns 404 for non-member', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: null }, { data: FAKE_CAMPAIGN, error: null }));
    mockGetCampaignRole.mockResolvedValue(null);

    const req = makeReq({ params: { id: 'camp-1' }, body: { name: 'x' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });

  it('returns 400 for invalid body', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: null }, { data: FAKE_CAMPAIGN, error: null }));
    mockGetCampaignRole.mockResolvedValue('dm');

    const req = makeReq({ params: { id: 'camp-1' }, body: { status: 'invalid-status' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(400);
  });

  it('returns 404 if campaign does not exist', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: null }, { data: null, error: null }));

    const req = makeReq({ params: { id: 'camp-1' }, body: { name: 'x' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });
});

describe('DELETE /campaigns/:id', () => {
  const handler = getHandler('delete', '/campaigns/:id');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
  });

  it('deletes campaign for DM and returns 204', async () => {
    mockFrom
      .mockReturnValueOnce(makeChain({ data: null, error: null }, { data: { id: 'camp-1' }, error: null })) // verify exists
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // delete
    mockGetCampaignRole.mockResolvedValue('dm');

    const req = makeReq({ params: { id: 'camp-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(204);
  });

  it('returns 403 for a player', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: null }, { data: { id: 'camp-1' }, error: null }));
    mockGetCampaignRole.mockResolvedValue('player');

    const req = makeReq({ params: { id: 'camp-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(403);
  });

  it('returns 404 for non-member', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: null }, { data: { id: 'camp-1' }, error: null }));
    mockGetCampaignRole.mockResolvedValue(null);

    const req = makeReq({ params: { id: 'camp-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });

  it('returns 404 if campaign does not exist', async () => {
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: null }, { data: null, error: null }));

    const req = makeReq({ params: { id: 'camp-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });
});

// ─── Member management tests ──────────────────────────────────────────────────

const FAKE_MEMBER = {
  campaign_id: 'camp-1',
  user_id: 'user-1',
  role: 'dm',
  joined_at: '2026-01-01T00:00:00.000Z',
};

describe('GET /campaigns/:id/members', () => {
  const handler = getHandler('get', '/campaigns/:id/members');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
    mockGetUserByEmail.mockReset();
  });

  it('returns member list for a member', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockFrom.mockReturnValue(makeChain({ data: [FAKE_MEMBER], error: null }));

    const req = makeReq({ params: { id: 'camp-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._json).toHaveBeenCalledOnce();
    const body = (res._json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.members).toHaveLength(1);
    expect(body.members[0].role).toBe('dm');
  });

  it('returns 404 for non-member', async () => {
    mockGetCampaignRole.mockResolvedValue(null);

    const req = makeReq({ params: { id: 'camp-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });
});

describe('POST /campaigns/:id/members', () => {
  const handler = getHandler('post', '/campaigns/:id/members');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
    mockGetUserByEmail.mockReset();
  });

  it('adds a player member by email', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockGetUserByEmail.mockResolvedValue({ id: 'user-2' });
    mockFrom
      .mockReturnValueOnce(makeChain({ data: null, error: null }, { data: null, error: null })) // check existing
      .mockReturnValueOnce(makeChain({ data: null, error: null }, { // insert
        data: { campaign_id: 'camp-1', user_id: 'user-2', role: 'player', joined_at: '2026-01-01T00:00:00.000Z' },
        error: null,
      }));

    const req = makeReq({ params: { id: 'camp-1' }, body: { email: 'player@test.com' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(201);
  });

  it('returns 403 for non-DM caller', async () => {
    mockGetCampaignRole.mockResolvedValue('player');

    const req = makeReq({ params: { id: 'camp-1' }, body: { email: 'x@x.com' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(403);
  });

  it('returns 404 for non-member caller', async () => {
    mockGetCampaignRole.mockResolvedValue(null);

    const req = makeReq({ params: { id: 'camp-1' }, body: { email: 'x@x.com' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });

  it('returns 404 when email does not match any user', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockGetUserByEmail.mockResolvedValue(null);

    const req = makeReq({ params: { id: 'camp-1' }, body: { email: 'unknown@test.com' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });

  it('returns 409 when user is already a member', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockGetUserByEmail.mockResolvedValue({ id: 'user-2' });
    mockFrom.mockReturnValueOnce(
      makeChain({ data: null, error: null }, { data: { user_id: 'user-2' }, error: null }), // existing member found
    );

    const req = makeReq({ params: { id: 'camp-1' }, body: { email: 'already@test.com' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(409);
  });

  it('returns 400 for invalid email', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');

    const req = makeReq({ params: { id: 'camp-1' }, body: { email: 'not-an-email' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(400);
  });
});

describe('DELETE /campaigns/:id/members/:userId', () => {
  const handler = getHandler('delete', '/campaigns/:id/members/:userId');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
    mockGetUserByEmail.mockReset();
  });

  it('removes a member and returns 204', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockFrom
      .mockReturnValueOnce(makeChain({ data: null, error: null }, { data: { user_id: 'user-2' }, error: null })) // target check
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // delete

    const req = makeReq({ params: { id: 'camp-1', userId: 'user-2' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(204);
  });

  it('returns 403 for non-DM caller', async () => {
    mockGetCampaignRole.mockResolvedValue('player');

    const req = makeReq({ params: { id: 'camp-1', userId: 'user-2' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when trying to remove self', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');

    // FAKE_USER.id === 'user-1'; removing self
    const req = makeReq({ params: { id: 'camp-1', userId: 'user-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(400);
  });

  it('returns 404 if target is not a member', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockFrom.mockReturnValueOnce(makeChain({ data: null, error: null }, { data: null, error: null }));

    const req = makeReq({ params: { id: 'camp-1', userId: 'user-99' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });
});
