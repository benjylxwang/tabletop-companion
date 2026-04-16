import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import type { User } from '@supabase/supabase-js';

// Stub supabaseService before any imports that reference it.
vi.mock('../lib/supabaseService.js', () => ({ supabaseService: {} }));

// We test the handlers directly, not through Express routing.
// Import the CRUD factory and wire it exactly as characters.ts does.
import { createCrudHandlers } from '../lib/crud.js';
import { Character, CharacterCreate, CharacterUpdate } from '@tabletop/shared';

// ─── Constants ───────────────────────────────────────────────────────────────

const CAMPAIGN_ID = 'camp-1';
const USER_ID = 'user-1';

const CHAR_ROW = {
  id: 'char-1',
  campaign_id: CAMPAIGN_ID,
  name: 'Aragorn',
  player_name: 'Ben',
  race_species: 'Human',
  class: 'Ranger',
  level_tier: 5,
  backstory: 'A wanderer from the north.',
  appearance: 'Tall and weathered.',
  personality: 'Stoic',
  goals_bonds: 'Reclaim the throne.',
  character_sheet_url: null,
  journal: null,
  created_at: '2026-01-01T00:00:00Z',
  dm_notes: 'Secret heir to the throne',
};

const CHAR_ROW_2 = {
  ...CHAR_ROW,
  id: 'char-2',
  name: 'Legolas',
  player_name: 'Rachel',
  race_species: 'Elf',
  class: 'Fighter',
  dm_notes: 'Hidden agenda',
};

// ─── Mock Supabase query builder ─────────────────────────────────────────────

interface TableMocks {
  selectResult?: { data: unknown; error: unknown };
  maybeSingleResult?: { data: unknown; error: unknown };
  insertSingleResult?: { data: unknown; error: unknown };
  updateSingleResult?: { data: unknown; error: unknown };
  deleteResult?: { data: unknown; error: unknown };
}

function buildTableClient(config: {
  memberRole: 'dm' | 'player' | null;
  characters: TableMocks;
}) {
  const { memberRole, characters: charMocks } = config;

  const memberQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(
      memberRole === null
        ? { data: null, error: null }
        : { data: { role: memberRole }, error: null },
    ),
  };

  const listResult = charMocks.selectResult ?? { data: [], error: null };
  const fetchResult = charMocks.maybeSingleResult ?? { data: null, error: null };
  const insertResult = charMocks.insertSingleResult ?? { data: null, error: null };
  const updateResult = charMocks.updateSingleResult ?? { data: null, error: null };
  const deleteResult = charMocks.deleteResult ?? { data: null, error: null };

  const charChain: Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (v: unknown) => unknown) => Promise<unknown>;
  } = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(fetchResult),
    single: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    then: function (resolve: (v: unknown) => unknown) {
      if (charChain.delete.mock.calls.length > 0) {
        return Promise.resolve(resolve(deleteResult));
      }
      return Promise.resolve(resolve(listResult));
    },
  };

  charChain.single.mockImplementation(() => {
    if (charChain.insert.mock.calls.length > 0 && charChain.update.mock.calls.length === 0) {
      return Promise.resolve(insertResult);
    }
    return Promise.resolve(updateResult);
  });

  const from = vi.fn((table: string) => {
    if (table === 'campaign_members') return memberQuery;
    return charChain;
  });

  const client = { from } as never;
  return { client, from, memberQuery, charChain };
}

// ─── Request/Response helpers ────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> & { view?: 'dm' | 'player' } = {}): Request {
  const { view = 'dm', ...rest } = overrides;
  return {
    user: { id: USER_ID } as User,
    requestedView: view,
    params: { campaignId: CAMPAIGN_ID },
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

function makeHandlers(client: ReturnType<typeof buildTableClient>['client']) {
  return createCrudHandlers({
    table: 'characters',
    baseSchema: Character,
    createSchema: CharacterCreate,
    updateSchema: CharacterUpdate,
    responseKey: { single: 'character', plural: 'characters' },
    resolveCampaignId: (req, row) => row?.campaign_id ?? req.params.campaignId ?? null,
    supabase: client,
  });
}

// ─── list ────────────────────────────────────────────────────────────────────

describe('characters — list', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined); });
  afterEach(() => { consoleSpy.mockRestore(); });

  it('returns characters with dm_notes for DM', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      characters: { selectResult: { data: [CHAR_ROW, CHAR_ROW_2], error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq();
    const res = makeRes();
    await handlers.list(req, res);
    expect(res._status).toHaveBeenCalledWith(200);
    const body = res._json.mock.calls[0]?.[0] as { characters: unknown[] };
    expect(body.characters).toHaveLength(2);
    expect(body.characters[0]).toHaveProperty('dm_notes');
  });

  it('strips dm_notes for player', async () => {
    const { client } = buildTableClient({
      memberRole: 'player',
      characters: { selectResult: { data: [CHAR_ROW], error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq();
    const res = makeRes();
    await handlers.list(req, res);
    expect(res._status).toHaveBeenCalledWith(200);
    const body = res._json.mock.calls[0]?.[0] as { characters: Record<string, unknown>[] };
    expect(body.characters[0]).not.toHaveProperty('dm_notes');
  });

  it('strips dm_notes for DM in player view', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      characters: { selectResult: { data: [CHAR_ROW], error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ view: 'player' });
    const res = makeRes();
    await handlers.list(req, res);
    const body = res._json.mock.calls[0]?.[0] as { characters: Record<string, unknown>[] };
    expect(body.characters[0]).not.toHaveProperty('dm_notes');
  });

  it('404s when user has no campaign membership', async () => {
    const { client } = buildTableClient({ memberRole: null, characters: {} });
    const handlers = makeHandlers(client);
    const req = makeReq();
    const res = makeRes();
    await handlers.list(req, res);
    expect(res._status).toHaveBeenCalledWith(404);
  });
});

// ─── get ─────────────────────────────────────────────────────────────────────

describe('characters — get', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined); });
  afterEach(() => { consoleSpy.mockRestore(); });

  it('returns character with dm_notes for DM', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      characters: { maybeSingleResult: { data: CHAR_ROW, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ params: { campaignId: CAMPAIGN_ID, id: 'char-1' } } as Partial<Request>);
    const res = makeRes();
    await handlers.get(req, res);
    expect(res._status).toHaveBeenCalledWith(200);
    const body = res._json.mock.calls[0]?.[0] as { character: Record<string, unknown> };
    expect(body.character).toHaveProperty('dm_notes');
    expect(body.character.name).toBe('Aragorn');
  });

  it('strips dm_notes for player', async () => {
    const { client } = buildTableClient({
      memberRole: 'player',
      characters: { maybeSingleResult: { data: CHAR_ROW, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ params: { campaignId: CAMPAIGN_ID, id: 'char-1' } } as Partial<Request>);
    const res = makeRes();
    await handlers.get(req, res);
    expect(res._status).toHaveBeenCalledWith(200);
    const body = res._json.mock.calls[0]?.[0] as { character: Record<string, unknown> };
    expect(body.character).not.toHaveProperty('dm_notes');
  });

  it('404s when character does not exist', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      characters: { maybeSingleResult: { data: null, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ params: { campaignId: CAMPAIGN_ID, id: 'nope' } } as Partial<Request>);
    const res = makeRes();
    await handlers.get(req, res);
    expect(res._status).toHaveBeenCalledWith(404);
  });
});

// ─── create ──────────────────────────────────────────────────────────────────

describe('characters — create', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined); });
  afterEach(() => { consoleSpy.mockRestore(); });

  it('201s for DM with valid body', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      characters: { insertSingleResult: { data: CHAR_ROW, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({
      body: {
        campaign_id: CAMPAIGN_ID,
        name: 'Aragorn',
        player_name: 'Ben',
        race_species: 'Human',
        class: 'Ranger',
        level_tier: 5,
      },
    } as Partial<Request>);
    const res = makeRes();
    await handlers.create(req, res);
    expect(res._status).toHaveBeenCalledWith(201);
    const body = res._json.mock.calls[0]?.[0] as { character: Record<string, unknown> };
    expect(body.character.name).toBe('Aragorn');
  });

  it('accepts free-text values without validation (system-agnostic)', async () => {
    const { client, charChain } = buildTableClient({
      memberRole: 'dm',
      characters: {
        insertSingleResult: {
          data: { ...CHAR_ROW, race_species: 'Homebrew Dragon', class: 'Pancake Chef', level_tier: 99 },
          error: null,
        },
      },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({
      body: {
        campaign_id: CAMPAIGN_ID,
        name: 'Silly PC',
        race_species: 'Homebrew Dragon',
        class: 'Pancake Chef',
        level_tier: 99,
      },
    } as Partial<Request>);
    const res = makeRes();
    await handlers.create(req, res);
    expect(res._status).toHaveBeenCalledWith(201);
    const insertArg = charChain.insert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArg.race_species).toBe('Homebrew Dragon');
    expect(insertArg.class).toBe('Pancake Chef');
  });

  it('403s when user is a player', async () => {
    const { client } = buildTableClient({ memberRole: 'player', characters: {} });
    const handlers = makeHandlers(client);
    const req = makeReq({ body: { campaign_id: CAMPAIGN_ID, name: 'Aragorn' } } as Partial<Request>);
    const res = makeRes();
    await handlers.create(req, res);
    expect(res._status).toHaveBeenCalledWith(403);
  });

  it('400s on invalid body (missing name)', async () => {
    const { client } = buildTableClient({ memberRole: 'dm', characters: {} });
    const handlers = makeHandlers(client);
    const req = makeReq({ body: { player_name: 'Ben' } } as Partial<Request>);
    const res = makeRes();
    await handlers.create(req, res);
    expect(res._status).toHaveBeenCalledWith(400);
    const body = res._json.mock.calls[0]?.[0] as { error: string };
    expect(body.error).toBe('invalid body');
  });

  it('forces campaign_id from URL, ignoring client-supplied value', async () => {
    const { client, charChain } = buildTableClient({
      memberRole: 'dm',
      characters: { insertSingleResult: { data: CHAR_ROW, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({
      body: { campaign_id: 'attacker-campaign', name: 'Aragorn' },
    } as Partial<Request>);
    const res = makeRes();
    await handlers.create(req, res);
    expect(res._status).toHaveBeenCalledWith(201);
    const insertArg = charChain.insert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArg.campaign_id).toBe(CAMPAIGN_ID);
  });
});

// ─── update ──────────────────────────────────────────────────────────────────

describe('characters — update', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined); });
  afterEach(() => { consoleSpy.mockRestore(); });

  it('200s with updated character for DM', async () => {
    const updated = { ...CHAR_ROW, name: 'Strider' };
    const { client } = buildTableClient({
      memberRole: 'dm',
      characters: {
        maybeSingleResult: { data: CHAR_ROW, error: null },
        updateSingleResult: { data: updated, error: null },
      },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({
      params: { campaignId: CAMPAIGN_ID, id: 'char-1' },
      body: { name: 'Strider' },
    } as Partial<Request>);
    const res = makeRes();
    await handlers.update(req, res);
    expect(res._status).toHaveBeenCalledWith(200);
    const body = res._json.mock.calls[0]?.[0] as { character: Record<string, unknown> };
    expect(body.character.name).toBe('Strider');
  });

  it('403s when user is a player', async () => {
    const { client } = buildTableClient({
      memberRole: 'player',
      characters: { maybeSingleResult: { data: CHAR_ROW, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({
      params: { campaignId: CAMPAIGN_ID, id: 'char-1' },
      body: { name: 'Strider' },
    } as Partial<Request>);
    const res = makeRes();
    await handlers.update(req, res);
    expect(res._status).toHaveBeenCalledWith(403);
  });

  it('404s when character does not exist', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      characters: { maybeSingleResult: { data: null, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({
      params: { campaignId: CAMPAIGN_ID, id: 'nope' },
      body: { name: 'x' },
    } as Partial<Request>);
    const res = makeRes();
    await handlers.update(req, res);
    expect(res._status).toHaveBeenCalledWith(404);
  });
});

// ─── remove ──────────────────────────────────────────────────────────────────

describe('characters — remove', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined); });
  afterEach(() => { consoleSpy.mockRestore(); });

  it('204s for DM', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      characters: {
        maybeSingleResult: { data: CHAR_ROW, error: null },
        deleteResult: { data: null, error: null },
      },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ params: { campaignId: CAMPAIGN_ID, id: 'char-1' } } as Partial<Request>);
    const res = makeRes();
    await handlers.remove(req, res);
    expect(res._status).toHaveBeenCalledWith(204);
    expect(res._end).toHaveBeenCalled();
  });

  it('403s for player', async () => {
    const { client } = buildTableClient({
      memberRole: 'player',
      characters: { maybeSingleResult: { data: CHAR_ROW, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ params: { campaignId: CAMPAIGN_ID, id: 'char-1' } } as Partial<Request>);
    const res = makeRes();
    await handlers.remove(req, res);
    expect(res._status).toHaveBeenCalledWith(403);
  });

  it('404s when character does not exist', async () => {
    const { client } = buildTableClient({
      memberRole: 'dm',
      characters: { maybeSingleResult: { data: null, error: null } },
    });
    const handlers = makeHandlers(client);
    const req = makeReq({ params: { campaignId: CAMPAIGN_ID, id: 'nope' } } as Partial<Request>);
    const res = makeRes();
    await handlers.remove(req, res);
    expect(res._status).toHaveBeenCalledWith(404);
  });
});
