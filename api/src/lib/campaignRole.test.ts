import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Stub the service-role module so importing campaignRole doesn't require env vars.
vi.mock('./supabaseService.js', () => ({ supabaseService: {} }));

import { getCampaignRole } from './campaignRole.js';

interface MockQuery {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

function makeClient(result: { data: unknown; error: unknown }) {
  const query: MockQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  const from = vi.fn().mockReturnValue(query);
  return { client: { from } as never, from, query };
}

describe('getCampaignRole', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('returns "dm" when the membership row has role dm', async () => {
    const { client, from, query } = makeClient({ data: { role: 'dm' }, error: null });
    const role = await getCampaignRole('u1', 'c1', client);
    expect(role).toBe('dm');
    expect(from).toHaveBeenCalledWith('campaign_members');
    expect(query.select).toHaveBeenCalledWith('role');
    expect(query.eq).toHaveBeenNthCalledWith(1, 'campaign_id', 'c1');
    expect(query.eq).toHaveBeenNthCalledWith(2, 'user_id', 'u1');
    expect(query.maybeSingle).toHaveBeenCalledOnce();
  });

  it('returns "player" when the membership row has role player', async () => {
    const { client } = makeClient({ data: { role: 'player' }, error: null });
    expect(await getCampaignRole('u1', 'c1', client)).toBe('player');
  });

  it('returns null when no membership row exists', async () => {
    const { client } = makeClient({ data: null, error: null });
    expect(await getCampaignRole('u1', 'c1', client)).toBe(null);
  });

  it('throws HttpError(500) and logs when Supabase returns an error', async () => {
    const { client } = makeClient({ data: null, error: { message: 'db down' } });
    await expect(getCampaignRole('u1', 'c1', client)).rejects.toThrow(/database error/);
    expect(consoleSpy).toHaveBeenCalled();
  });
});
