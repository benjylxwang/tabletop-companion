import { test, expect } from '@playwright/test';

const apiURL = process.env.PLAYWRIGHT_API_URL;
const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL;
const supabaseAnonKey = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY;

// ─── Auth setup ───────────────────────────────────────────────────────────────

let token: string;
let campaignId: string;
let characterId: string;

const testEmail = `e2e-char-${Date.now()}@example.com`;
const testPassword = 'E2eTestPass1!';

test.describe('Characters CRUD (API)', () => {
  test.skip(!apiURL || !supabaseUrl || !supabaseAnonKey, 'API/Supabase env vars required');

  test.beforeAll(async ({ request }) => {
    // Sign up a fresh test user
    const signupRes = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: supabaseAnonKey!, 'Content-Type': 'application/json' },
      data: { email: testEmail, password: testPassword },
    });
    expect(signupRes.ok()).toBeTruthy();
    const signupBody = await signupRes.json();
    token = (signupBody as { access_token: string }).access_token;
    expect(token).toBeTruthy();

    // Create a campaign to nest characters under
    const campaignRes = await request.post(`${apiURL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Characters E2E Campaign', status: 'Active' },
    });
    expect(campaignRes.status()).toBe(201);
    const campaignBody = await campaignRes.json();
    campaignId = (campaignBody as { campaign: { id: string } }).campaign.id;
  });

  test('POST creates a character with all fields', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/campaigns/${campaignId}/characters`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        campaign_id: campaignId,
        name: 'Aragorn',
        player_name: 'Ben',
        race_species: 'Human',
        class: 'Ranger',
        level_tier: 5,
        backstory: 'A wanderer from the north.',
        appearance: 'Tall and weathered.',
        personality: 'Stoic and determined.',
        goals_bonds: 'Reclaim the throne of Gondor.',
        dm_notes: 'Secret heir to the throne.',
      },
    });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as { character: Record<string, unknown> };
    expect(body.character.name).toBe('Aragorn');
    expect(body.character.player_name).toBe('Ben');
    expect(body.character.race_species).toBe('Human');
    expect(body.character.class).toBe('Ranger');
    expect(body.character.level_tier).toBe(5);
    expect(body.character.dm_notes).toBe('Secret heir to the throne.');
    expect(body.character.id).toBeTruthy();
    characterId = body.character.id as string;
  });

  test('POST accepts free-text values without validation (system-agnostic)', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/campaigns/${campaignId}/characters`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        campaign_id: campaignId,
        name: 'Silly PC',
        race_species: 'Homebrew Dragon',
        class: 'Pancake Chef',
        level_tier: 99,
      },
    });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as { character: Record<string, unknown> };
    expect(body.character.race_species).toBe('Homebrew Dragon');
    expect(body.character.class).toBe('Pancake Chef');
    expect(body.character.level_tier).toBe(99);

    // Cleanup
    await request.delete(
      `${apiURL}/api/campaigns/${campaignId}/characters/${body.character.id}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  });

  test('GET list returns characters in campaign', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/characters`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { characters: { id: string }[] };
    const ids = body.characters.map((c) => c.id);
    expect(ids).toContain(characterId);
  });

  test('GET single returns character with dm_notes for DM', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/characters/${characterId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { character: Record<string, unknown> };
    expect(body.character.name).toBe('Aragorn');
    expect(body.character.dm_notes).toBe('Secret heir to the throne.');
  });

  test('GET with ?view=player strips dm_notes', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/characters/${characterId}?view=player`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { character: Record<string, unknown> };
    expect(body.character.name).toBe('Aragorn');
    expect(body.character.dm_notes).toBeUndefined();
  });

  test('GET list with ?view=player strips dm_notes from all characters', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/characters?view=player`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { characters: Record<string, unknown>[] };
    for (const char of body.characters) {
      expect(char.dm_notes).toBeUndefined();
    }
  });

  test('PATCH updates character fields', async ({ request }) => {
    const res = await request.patch(
      `${apiURL}/api/campaigns/${campaignId}/characters/${characterId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { name: 'Strider', level_tier: 10 },
      },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { character: Record<string, unknown> };
    expect(body.character.name).toBe('Strider');
    expect(body.character.level_tier).toBe(10);
    // Unchanged fields preserved
    expect(body.character.player_name).toBe('Ben');
  });

  test('DELETE removes the character', async ({ request }) => {
    const res = await request.delete(
      `${apiURL}/api/campaigns/${campaignId}/characters/${characterId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(204);
  });

  test('GET after delete returns 404', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/characters/${characterId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(404);
  });

  // Cleanup campaign
  test('cleanup: delete test campaign', async ({ request }) => {
    const res = await request.delete(`${apiURL}/api/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(204);
  });
});
