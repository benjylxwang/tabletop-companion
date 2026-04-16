import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { User } from '@supabase/supabase-js';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFrom = vi.fn();

vi.mock('../lib/supabaseService.js', () => ({
  supabaseService: { from: (...args: unknown[]) => mockFrom(...args) },
  getUserByEmail: vi.fn(),
}));

const mockGetCampaignRole = vi.fn();

vi.mock('../lib/campaignRole.js', () => ({
  getCampaignRole: (...args: unknown[]) => mockGetCampaignRole(...args),
}));

// Fully mock the anthropic module so importing `./ai.js` does not require
// ANTHROPIC_API_KEY and does not open network calls.
const mockGenerateJson = vi.fn();
const mockGenerateText = vi.fn();

vi.mock('../lib/anthropic.js', () => ({
  generateJson: (...args: unknown[]) => mockGenerateJson(...args),
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  MODEL: 'claude-sonnet-4-5',
  anthropic: {},
}));

const { aiRouter } = await import('./ai.js');

// ─── Chain builder (matches campaigns.test.ts) ────────────────────────────────

type DBResult = { data: unknown; error: unknown };

function makeChain(directResult: DBResult, singleResult?: DBResult) {
  const single = singleResult ?? directResult;
  const self: Record<string, unknown> = {
    select: vi.fn(() => self),
    eq: vi.fn(() => self),
    insert: vi.fn(() => self),
    update: vi.fn(() => self),
    delete: vi.fn(() => self),
    limit: vi.fn(() => Promise.resolve(directResult)),
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
  const layer = (aiRouter.stack as Array<{
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

// ─── Canned payload for generator ────────────────────────────────────────────

const PAYLOAD = {
  campaign: { name: 'Test Campaign', system: 'D&D 5e' },
  factions: [
    { ref: 'faction-0', name: 'Harpers' },
    { ref: 'faction-1', name: 'Zhentarim' },
  ],
  sessions: [
    { ref: 'session-0', title: 'The Beginning' },
    { ref: 'session-1', title: 'Into the Woods' },
    { ref: 'session-2', title: 'The Ambush' },
  ],
  locations: [
    { ref: 'loc-0', name: 'Waterdeep' },
    { ref: 'loc-1', name: 'The Yawning Portal', parent_ref: 'loc-0' },
    { ref: 'loc-2', name: 'Skullport' },
    { ref: 'loc-3', name: 'Neverwinter' },
  ],
  npcs: [
    { ref: 'npc-0', name: 'Volo', faction_ref: 'faction-0', first_session_ref: 'session-0' },
    { ref: 'npc-1', name: 'Xanathar' },
    { ref: 'npc-2', name: 'Durnan' },
    { ref: 'npc-3', name: 'Mirt the Moneylender' },
    { ref: 'npc-4', name: 'Laeral Silverhand' },
  ],
  characters: [
    { name: 'Thorin', race_species: 'Dwarf', class: 'Fighter' },
    { name: 'Elara', race_species: 'Elf', class: 'Wizard' },
    { name: 'Finn', race_species: 'Halfling', class: 'Rogue' },
  ],
  lore: [
    { title: 'The Spellplague', category: 'history' as const },
    { title: 'Weave of Magic', category: 'magic' as const },
    { title: 'Faerûnian Pantheon', category: 'religion' as const },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /ai/generate-campaign', () => {
  const handler = getHandler('post', '/generate-campaign');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
    mockGenerateJson.mockReset();
  });

  it('returns 400 for missing mode', async () => {
    const req = makeReq({ body: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for populate without campaign_id', async () => {
    const req = makeReq({ body: { mode: 'populate' } });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toHaveBeenCalledWith(400);
  });

  it('returns 403 for populate when caller is not DM', async () => {
    mockGetCampaignRole.mockResolvedValue('player');
    const req = makeReq({ body: { mode: 'populate', campaign_id: 'camp-1' } });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toHaveBeenCalledWith(403);
  });

  it('returns 404 for populate when caller is not a member', async () => {
    mockGetCampaignRole.mockResolvedValue(null);
    const req = makeReq({ body: { mode: 'populate', campaign_id: 'camp-1' } });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toHaveBeenCalledWith(404);
  });

  it('creates a new campaign and inserts all children in FK order', async () => {
    mockGenerateJson.mockResolvedValue(PAYLOAD);

    // Track call order + synthesize ids that match ref counts.
    const tableCalls: string[] = [];
    const makeIdRows = (n: number, prefix: string) =>
      Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}` }));

    mockFrom.mockImplementation((table: string) => {
      tableCalls.push(table);
      switch (table) {
        case 'campaigns':
          // First call: insert campaign → returns { id: 'new-camp' }
          // Later calls (for the location parent update) also go through here.
          return makeChain(
            { data: [{ id: 'new-camp' }], error: null },
            { data: { id: 'new-camp' }, error: null },
          );
        case 'campaign_members':
          return makeChain({ data: null, error: null });
        case 'factions':
          return makeChain({ data: makeIdRows(PAYLOAD.factions.length, 'fac'), error: null });
        case 'sessions':
          return makeChain({ data: makeIdRows(PAYLOAD.sessions.length, 'ses'), error: null });
        case 'locations':
          return makeChain({ data: makeIdRows(PAYLOAD.locations.length, 'loc'), error: null });
        case 'npcs':
          return makeChain({ data: makeIdRows(PAYLOAD.npcs.length, 'npc'), error: null });
        case 'characters':
          return makeChain({
            data: makeIdRows(PAYLOAD.characters.length, 'char'),
            error: null,
          });
        case 'lore':
          return makeChain({ data: makeIdRows(PAYLOAD.lore.length, 'lore'), error: null });
        default:
          throw new Error(`unexpected table: ${table}`);
      }
    });

    const req = makeReq({ body: { mode: 'new', seed: 'high-fantasy heist' } });
    const res = makeRes();
    await handler(req, res);

    // Should return 201 with the new campaign id + counts
    expect(res._status).toHaveBeenCalledWith(201);
    const body = (res._status as ReturnType<typeof vi.fn>).mock.results[0].value.json.mock
      .calls[0][0];
    expect(body.campaign_id).toBe('new-camp');
    expect(body.counts).toEqual({
      factions: PAYLOAD.factions.length,
      sessions: PAYLOAD.sessions.length,
      locations: PAYLOAD.locations.length,
      npcs: PAYLOAD.npcs.length,
      characters: PAYLOAD.characters.length,
      lore: PAYLOAD.lore.length,
    });

    // FK order: campaign row first, then factions before npcs, sessions before npcs,
    // locations before npcs, npcs before characters/lore is not strictly required
    // but we assert the documented sequence.
    const relevant = tableCalls.filter((t) =>
      ['campaigns', 'factions', 'sessions', 'locations', 'npcs', 'characters', 'lore'].includes(t),
    );
    expect(relevant.indexOf('campaigns')).toBeLessThan(relevant.indexOf('factions'));
    expect(relevant.indexOf('factions')).toBeLessThan(relevant.indexOf('npcs'));
    expect(relevant.indexOf('sessions')).toBeLessThan(relevant.indexOf('npcs'));
    expect(relevant.indexOf('locations')).toBeLessThan(relevant.indexOf('npcs'));

    // One extra locations write to resolve the parent_ref
    expect(tableCalls.filter((t) => t === 'locations').length).toBe(2);
  });

  it('populates an existing campaign without creating a new one', async () => {
    mockGenerateJson.mockResolvedValue(PAYLOAD);
    mockGetCampaignRole.mockResolvedValue('dm');

    const tableCalls: string[] = [];
    const makeIdRows = (n: number, p: string) =>
      Array.from({ length: n }, (_, i) => ({ id: `${p}-${i}` }));

    mockFrom.mockImplementation((table: string) => {
      tableCalls.push(table);
      if (table === 'campaigns') return makeChain({ data: null, error: null });
      if (table === 'factions')
        return makeChain({ data: makeIdRows(PAYLOAD.factions.length, 'fac'), error: null });
      if (table === 'sessions')
        return makeChain({ data: makeIdRows(PAYLOAD.sessions.length, 'ses'), error: null });
      if (table === 'locations')
        return makeChain({ data: makeIdRows(PAYLOAD.locations.length, 'loc'), error: null });
      if (table === 'npcs')
        return makeChain({ data: makeIdRows(PAYLOAD.npcs.length, 'npc'), error: null });
      if (table === 'characters')
        return makeChain({ data: makeIdRows(PAYLOAD.characters.length, 'ch'), error: null });
      if (table === 'lore')
        return makeChain({ data: makeIdRows(PAYLOAD.lore.length, 'lo'), error: null });
      throw new Error(`unexpected: ${table}`);
    });

    const req = makeReq({ body: { mode: 'populate', campaign_id: 'existing-camp' } });
    const res = makeRes();
    await handler(req, res);

    expect(res._status).toHaveBeenCalledWith(201);
    const body = (res._status as ReturnType<typeof vi.fn>).mock.results[0].value.json.mock
      .calls[0][0];
    expect(body.campaign_id).toBe('existing-camp');
    // No campaign_members insert in populate mode
    expect(tableCalls).not.toContain('campaign_members');
  });
});

describe('POST /ai/generate-field', () => {
  const handler = getHandler('post', '/generate-field');

  beforeEach(() => {
    mockFrom.mockReset();
    mockGetCampaignRole.mockReset();
    mockGenerateText.mockReset();
  });

  it('returns 400 for invalid body', async () => {
    const req = makeReq({ body: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toHaveBeenCalledWith(400);
  });

  it('returns 403 for non-DM caller', async () => {
    mockGetCampaignRole.mockResolvedValue('player');
    const req = makeReq({
      body: { campaign_id: 'c1', entity_type: 'npc', field_name: 'appearance' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toHaveBeenCalledWith(403);
  });

  it('returns 404 for non-member caller', async () => {
    mockGetCampaignRole.mockResolvedValue(null);
    const req = makeReq({
      body: { campaign_id: 'c1', entity_type: 'npc', field_name: 'appearance' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toHaveBeenCalledWith(404);
  });

  it('returns generated text for a DM', async () => {
    mockGetCampaignRole.mockResolvedValue('dm');
    mockGenerateText.mockResolvedValue('A gaunt figure with silver eyes.');

    mockFrom.mockImplementation((table: string) => {
      if (table === 'campaigns') {
        return makeChain(
          { data: null, error: null },
          { data: { name: 'Test', system: 'D&D 5e', description: null }, error: null },
        );
      }
      // factions/npcs/locations lookups for the snapshot
      return makeChain({ data: [], error: null });
    });

    const req = makeReq({
      body: {
        campaign_id: 'c1',
        entity_type: 'npc',
        field_name: 'appearance',
        entity_draft: { name: 'Volo' },
      },
    });
    const res = makeRes();
    await handler(req, res);

    expect(res._json).toHaveBeenCalledOnce();
    const body = (res._json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.text).toBe('A gaunt figure with silver eyes.');
  });
});
