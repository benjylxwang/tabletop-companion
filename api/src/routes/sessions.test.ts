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
const { sessionsRouter } = await import('./sessions.js');

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

const FAKE_SESSION = {
  id: 'sess-1',
  campaign_id: 'camp-1',
  session_number: 1,
  title: 'Session 1 — Arrival in Phandalin',
  date_played: '2026-01-15',
  summary: 'The party arrived.',
  highlights: ['Great roleplay', 'Dragon encounter'],
  xp_awarded: 300,
  dm_notes: 'secret DM stuff',
  created_at: '2026-01-01T00:00:00.000Z',
};

const FAKE_SESSION_2 = {
  ...FAKE_SESSION,
  id: 'sess-2',
  session_number: 2,
  title: 'Session 2 — The Mine',
  dm_notes: 'more secrets',
};

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

function getHandler(method: string, path: string) {
  const layer = (sessionsRouter.stack as Array<{
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

describe('GET /campaigns/:campaignId/sessions', () => {
  const handler = getHandler('get', '/campaigns/:campaignId/sessions');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
  });

  it('returns sessions for a campaign member', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    const chain = makeChain({ data: [FAKE_SESSION_2, FAKE_SESSION], error: null });
    mockFrom.mockReturnValue(chain);

    const req = makeReq({ params: { campaignId: 'camp-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(200);
    const body = (res._status as ReturnType<typeof vi.fn>).mock.results[0].value.json.mock.calls[0][0];
    expect(body.sessions).toHaveLength(2);
    // Verify order() was called with descending
    expect(chain.order).toHaveBeenCalledWith('session_number', { ascending: false });
  });

  it('strips dm_notes for player view', async () => {
    mockGetCampaignRole.mockResolvedValue('player');
    mockFrom.mockReturnValue(makeChain({ data: [FAKE_SESSION], error: null }));

    const req = makeReq({ params: { campaignId: 'camp-1' }, requestedView: 'player' });
    const res = makeRes();
    await handler(req, res);

    const body = (res._status as ReturnType<typeof vi.fn>).mock.results[0].value.json.mock.calls[0][0];
    expect(body.sessions[0].dm_notes).toBeUndefined();
  });

  it('strips dm_notes for DM in player view mode', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockFrom.mockReturnValue(makeChain({ data: [FAKE_SESSION], error: null }));

    const req = makeReq({ params: { campaignId: 'camp-1' }, requestedView: 'player' });
    const res = makeRes();
    await handler(req, res);

    const body = (res._status as ReturnType<typeof vi.fn>).mock.results[0].value.json.mock.calls[0][0];
    expect(body.sessions[0].dm_notes).toBeUndefined();
  });

  it('returns 404 for non-member', async () => {
    mockGetCampaignRole.mockResolvedValue(null);

    const req = makeReq({ params: { campaignId: 'camp-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on database error', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'db error' } }));

    const req = makeReq({ params: { campaignId: 'camp-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(500);
  });
});

describe('POST /campaigns/:campaignId/sessions', () => {
  const handler = getHandler('post', '/campaigns/:campaignId/sessions');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
  });

  it('creates a session for a DM', async () => {
    // CRUD factory: campaign_members check (via getCampaignRole mock),
    // then sessions.insert().select().single()
    mockGetCampaignRole.mockResolvedValue('dm');
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: null }, { data: FAKE_SESSION, error: null }),
    );

    const req = makeReq({
      params: { campaignId: 'camp-1' },
      body: {
        campaign_id: 'camp-1',
        session_number: 1,
        title: 'Session 1 — Arrival in Phandalin',
        date_played: '2026-01-15',
        summary: 'The party arrived.',
        highlights: ['Great roleplay'],
        dm_notes: 'secret',
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(201);
  });

  it('returns 403 for a player', async () => {
    mockGetCampaignRole.mockResolvedValue('player');

    const req = makeReq({
      params: { campaignId: 'camp-1' },
      body: {
        campaign_id: 'camp-1',
        session_number: 1,
        title: 'Session 1',
        date_played: '2026-01-15',
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(403);
  });

  it('returns 400 for invalid body', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');

    const req = makeReq({
      params: { campaignId: 'camp-1' },
      body: { title: 'Missing required fields' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(400);
  });
});

describe('GET /campaigns/:campaignId/sessions/:id', () => {
  const handler = getHandler('get', '/campaigns/:campaignId/sessions/:id');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
  });

  it('returns a single session for a member', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: null }, { data: FAKE_SESSION, error: null }),
    );

    const req = makeReq({ params: { campaignId: 'camp-1', id: 'sess-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(200);
    const body = (res._status as ReturnType<typeof vi.fn>).mock.results[0].value.json.mock.calls[0][0];
    expect(body.session.id).toBe('sess-1');
    expect(body.session.dm_notes).toBe('secret DM stuff');
  });

  it('strips dm_notes for player', async () => {
    mockGetCampaignRole.mockResolvedValue('player');
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: null }, { data: FAKE_SESSION, error: null }),
    );

    const req = makeReq({ params: { campaignId: 'camp-1', id: 'sess-1' } });
    const res = makeRes();
    await handler(req, res);

    const body = (res._status as ReturnType<typeof vi.fn>).mock.results[0].value.json.mock.calls[0][0];
    expect(body.session.dm_notes).toBeUndefined();
  });

  it('returns 404 for non-existent session', async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: null }, { data: null, error: null }),
    );

    const req = makeReq({ params: { campaignId: 'camp-1', id: 'sess-999' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });
});

describe('PATCH /campaigns/:campaignId/sessions/:id', () => {
  const handler = getHandler('patch', '/campaigns/:campaignId/sessions/:id');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
  });

  const UPDATED = { ...FAKE_SESSION, title: 'Updated Title' };

  it('updates a session for a DM', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockFrom
      .mockReturnValueOnce(makeChain({ data: null, error: null }, { data: FAKE_SESSION, error: null })) // fetch existing
      .mockReturnValueOnce(makeChain({ data: null, error: null }, { data: UPDATED, error: null })); // update

    const req = makeReq({
      params: { campaignId: 'camp-1', id: 'sess-1' },
      body: { title: 'Updated Title' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(200);
    const body = (res._status as ReturnType<typeof vi.fn>).mock.results[0].value.json.mock.calls[0][0];
    expect(body.session.title).toBe('Updated Title');
  });

  it('returns 403 for a player', async () => {
    mockGetCampaignRole.mockResolvedValue('player');
    mockFrom.mockReturnValueOnce(
      makeChain({ data: null, error: null }, { data: FAKE_SESSION, error: null }),
    );

    const req = makeReq({
      params: { campaignId: 'camp-1', id: 'sess-1' },
      body: { title: 'x' },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(403);
  });
});

describe('DELETE /campaigns/:campaignId/sessions/:id', () => {
  const handler = getHandler('delete', '/campaigns/:campaignId/sessions/:id');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
  });

  it('deletes a session for a DM and returns 204', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockFrom
      .mockReturnValueOnce(makeChain({ data: null, error: null }, { data: FAKE_SESSION, error: null })) // fetch existing
      .mockReturnValueOnce(makeChain({ data: null, error: null })); // delete

    const req = makeReq({ params: { campaignId: 'camp-1', id: 'sess-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(204);
  });

  it('returns 403 for a player', async () => {
    mockGetCampaignRole.mockResolvedValue('player');
    mockFrom.mockReturnValueOnce(
      makeChain({ data: null, error: null }, { data: FAKE_SESSION, error: null }),
    );

    const req = makeReq({ params: { campaignId: 'camp-1', id: 'sess-1' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(403);
  });

  it('returns 404 for non-existent session', async () => {
    mockFrom.mockReturnValueOnce(
      makeChain({ data: null, error: null }, { data: null, error: null }),
    );

    const req = makeReq({ params: { campaignId: 'camp-1', id: 'sess-999' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(404);
  });
});
