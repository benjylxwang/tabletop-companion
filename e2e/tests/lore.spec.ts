import { test, expect } from '@playwright/test';

const apiURL = process.env.PLAYWRIGHT_API_URL;
const baseURL = process.env.PLAYWRIGHT_BASE_URL;
const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL;
const supabaseAnonKey = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY;

// ─── Auth setup ───────────────────────────────────────────────────────────────

let token: string;
let campaignId: string;
let publicLoreId: string;
let privateLoreId: string;

const testEmail = `e2e-lore-${Date.now()}@example.com`;
const testPassword = 'E2eTestPass1!';

test.describe('Lore CRUD (API)', () => {
  test.skip(!apiURL || !supabaseUrl || !supabaseAnonKey, 'API/Supabase env vars required');

  test.beforeAll(async ({ request }) => {
    // Sign up a fresh test user
    const signupRes = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: supabaseAnonKey!, 'Content-Type': 'application/json' },
      data: { email: testEmail, password: testPassword },
    });
    expect(signupRes.ok()).toBeTruthy();
    const body = await signupRes.json();
    token = (body as { access_token: string }).access_token;
    expect(token).toBeTruthy();

    // Create a campaign to attach lore to
    const campaignRes = await request.post(`${apiURL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Lore E2E Campaign', status: 'Active' },
    });
    expect(campaignRes.status()).toBe(201);
    const campaignBody = await campaignRes.json();
    campaignId = (campaignBody as { campaign: { id: string } }).campaign.id;
    expect(campaignId).toBeTruthy();
  });

  // ─── Create ────────────────────────────────────────────────────────────────

  test('POST /lore creates a public entry (201)', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/campaigns/${campaignId}/lore`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: 'The Age of Dragons',
        category: 'History',
        content: 'Long ago, dragons ruled the world.',
        visibility: 'Public',
        dm_notes: 'Secret origin story',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.lore.title).toBe('The Age of Dragons');
    expect(body.lore.visibility).toBe('Public');
    expect(body.lore.category).toBe('History');
    publicLoreId = (body as { lore: { id: string } }).lore.id;
    expect(publicLoreId).toBeTruthy();
  });

  test('POST /lore creates a private entry (201)', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/campaigns/${campaignId}/lore`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: 'The True Villain',
        category: 'Politics',
        content: 'The king is secretly evil.',
        visibility: 'Private',
        dm_notes: 'Players must never find out yet',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    privateLoreId = (body as { lore: { id: string } }).lore.id;
    expect(privateLoreId).toBeTruthy();
  });

  test('POST /lore returns 400 for missing title', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/campaigns/${campaignId}/lore`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { category: 'History', visibility: 'Public' },
    });
    expect(res.status()).toBe(400);
  });

  // ─── List ──────────────────────────────────────────────────────────────────

  test('GET /lore returns both entries in DM view', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/lore`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const ids = (body.lore as { id: string }[]).map((e) => e.id);
    expect(ids).toContain(publicLoreId);
    expect(ids).toContain(privateLoreId);
  });

  test('GET /lore?view=player hides Private entries completely', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/lore?view=player`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const ids = (body.lore as { id: string }[]).map((e) => e.id);
    expect(ids).toContain(publicLoreId);
    expect(ids).not.toContain(privateLoreId);
  });

  test('GET /lore?view=player strips dm_notes from Public entries', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/lore?view=player`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const publicEntry = (body.lore as Record<string, unknown>[]).find(
      (e) => e.id === publicLoreId,
    );
    expect(publicEntry).toBeTruthy();
    expect(publicEntry?.dm_notes).toBeUndefined();
  });

  // ─── Get single ───────────────────────────────────────────────────────────

  test('GET /lore/:id returns DM notes in DM view', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/lore/${publicLoreId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.lore.dm_notes).toBe('Secret origin story');
  });

  test('GET /lore/:id?view=player returns 404 for Private entry', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/lore/${privateLoreId}?view=player`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(404);
  });

  test('GET /lore/:id?view=player strips dm_notes from Public entry', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/lore/${publicLoreId}?view=player`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { lore: Record<string, unknown> };
    expect(body.lore.dm_notes).toBeUndefined();
  });

  // ─── Update ────────────────────────────────────────────────────────────────

  test('PUT /lore/:id updates the entry', async ({ request }) => {
    const res = await request.put(`${apiURL}/api/campaigns/${campaignId}/lore/${publicLoreId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'The Age of Dragons (Updated)' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.lore.title).toBe('The Age of Dragons (Updated)');
  });

  // ─── Delete ────────────────────────────────────────────────────────────────

  test('DELETE /lore/:id returns 204', async ({ request }) => {
    // Create a throwaway entry to delete
    const createRes = await request.post(`${apiURL}/api/campaigns/${campaignId}/lore`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'To Be Deleted', category: 'Magic', visibility: 'Public' },
    });
    const deleteId = ((await createRes.json()) as { lore: { id: string } }).lore.id;

    const res = await request.delete(`${apiURL}/api/campaigns/${campaignId}/lore/${deleteId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(204);

    // Confirm it's gone
    const checkRes = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/lore/${deleteId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(checkRes.status()).toBe(404);
  });

  // ─── Permission model ─────────────────────────────────────────────────────

  test('Non-member GET /lore returns 404', async ({ request }) => {
    const otherEmail = `e2e-lore-other-${Date.now()}@example.com`;
    const signupRes = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: supabaseAnonKey!, 'Content-Type': 'application/json' },
      data: { email: otherEmail, password: testPassword },
    });
    const otherToken = ((await signupRes.json()) as { access_token: string }).access_token;

    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/lore`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    expect(res.status()).toBe(404);
  });
});

// ─── UI tests ─────────────────────────────────────────────────────────────────

test.describe('Lore UI', () => {
  test.skip(!baseURL, 'PLAYWRIGHT_BASE_URL required for UI tests');

  test('lore list page renders the login page for unauthenticated access', async ({ page }) => {
    await page.goto(`${baseURL}/login`);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
