import { test, expect } from '@playwright/test';

const apiURL = process.env.PLAYWRIGHT_API_URL;
const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL;
const supabaseAnonKey = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY;

// ─── Auth + campaign setup ───────────────────────────────────────────────────

let token: string;
let campaignId: string;
let createdSessionId: string;

const testEmail = `e2e-sessions-${Date.now()}@example.com`;
const testPassword = 'E2eTestPass1!';

test.describe('Session CRUD (API)', () => {
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

    // Create a campaign to host sessions
    const campRes = await request.post(`${apiURL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'E2E Session Campaign', status: 'Active' },
    });
    expect(campRes.status()).toBe(201);
    const campBody = await campRes.json();
    campaignId = (campBody as { campaign: { id: string } }).campaign.id;
  });

  test('POST /api/campaigns/:id/sessions creates a session', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/campaigns/${campaignId}/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        campaign_id: campaignId,
        session_number: 1,
        title: 'Session 1 — The Beginning',
        date_played: '2026-01-15',
        summary: 'The adventure begins.',
        highlights: ['Met the quest giver', 'First combat'],
        dm_notes: 'Players are hooked',
        xp_awarded: 100,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.session.title).toBe('Session 1 — The Beginning');
    expect(body.session.session_number).toBe(1);
    expect(body.session.highlights).toEqual(['Met the quest giver', 'First combat']);
    expect(body.session.dm_notes).toBe('Players are hooked');
    createdSessionId = body.session.id as string;
  });

  test('GET /api/campaigns/:id/sessions lists sessions', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.sessions.length).toBeGreaterThanOrEqual(1);
    const ids = (body.sessions as { id: string }[]).map((s) => s.id);
    expect(ids).toContain(createdSessionId);
  });

  test('GET /api/campaigns/:id/sessions/:id returns the session', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/sessions/${createdSessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.session.id).toBe(createdSessionId);
    expect(body.session.dm_notes).toBe('Players are hooked');
  });

  test('GET /api/campaigns/:id/sessions?view=player strips dm_notes', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/sessions?view=player`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { sessions: Record<string, unknown>[] };
    for (const session of body.sessions) {
      expect(session.dm_notes).toBeUndefined();
    }
  });

  test('GET /api/campaigns/:id/sessions/:id?view=player strips dm_notes', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/sessions/${createdSessionId}?view=player`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { session: Record<string, unknown> };
    expect(body.session.dm_notes).toBeUndefined();
  });

  test('PATCH /api/campaigns/:id/sessions/:id updates the session', async ({ request }) => {
    const res = await request.patch(
      `${apiURL}/api/campaigns/${campaignId}/sessions/${createdSessionId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { title: 'Session 1 — Updated Title' },
      },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.session.title).toBe('Session 1 — Updated Title');
  });

  test('DELETE /api/campaigns/:id/sessions/:id returns 204', async ({ request }) => {
    const res = await request.delete(
      `${apiURL}/api/campaigns/${campaignId}/sessions/${createdSessionId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(204);
  });

  test('GET /api/campaigns/:id/sessions after delete does not include deleted session', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const ids = (body.sessions as { id: string }[]).map((s) => s.id);
    expect(ids).not.toContain(createdSessionId);
  });

  // Cleanup: delete the campaign
  test.afterAll(async ({ request }) => {
    if (campaignId && token) {
      await request.delete(`${apiURL}/api/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });
});
