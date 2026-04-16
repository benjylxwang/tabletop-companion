import {
  CampaignCreate,
  CampaignUpdate,
  CampaignInvitationResponse,
  CampaignInvitationsResponse,
  CampaignMembersResponse,
  CampaignPendingInvitationsResponse,
  CampaignResponse,
  CampaignsResponse,
  GenerateCampaignResponse,
  GenerateFieldResponse,
  HealthResponse,
  LocationCreate,
  LocationResponse,
  LocationUpdate,
  LocationsResponse,
  MeResponse,
  NpcCreate,
  NpcResponse,
  NpcUpdate,
  NpcsResponse,
  SessionCreate,
  SessionUpdate,
  SessionResponse,
  SessionsResponse,
} from '@tabletop/shared';
import type {
  GenerateCampaignRequest,
  GenerateFieldRequest,
} from '@tabletop/shared';
import type { ViewMode } from '@tabletop/shared';
import { supabase } from './supabase';

const baseUrl = import.meta.env.VITE_API_URL ?? '';

function viewQuery(viewMode: ViewMode): string {
  return viewMode === 'player' ? '?view=player' : '';
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${baseUrl}/health`);
  if (!res.ok) throw new Error(`health ${res.status}`);
  return HealthResponse.parse(await res.json());
}

export async function fetchMe(): Promise<MeResponse> {
  const res = await authedFetch('/api/me');
  if (!res.ok) throw new Error(`me ${res.status}`);
  return MeResponse.parse(await res.json());
}

export async function fetchCampaigns(viewMode: ViewMode): Promise<CampaignsResponse> {
  const res = await authedFetch(`/api/campaigns${viewQuery(viewMode)}`);
  if (!res.ok) throw new Error(`campaigns ${res.status}`);
  return CampaignsResponse.parse(await res.json());
}

export async function fetchCampaign(id: string, viewMode: ViewMode): Promise<CampaignResponse> {
  const res = await authedFetch(`/api/campaigns/${id}${viewQuery(viewMode)}`);
  if (!res.ok) throw new Error(`campaign ${res.status}`);
  return CampaignResponse.parse(await res.json());
}

export async function createCampaign(data: CampaignCreate): Promise<CampaignResponse> {
  const res = await authedFetch('/api/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`create campaign ${res.status}`);
  return CampaignResponse.parse(await res.json());
}

export async function updateCampaign(id: string, data: CampaignUpdate): Promise<CampaignResponse> {
  const res = await authedFetch(`/api/campaigns/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`update campaign ${res.status}`);
  return CampaignResponse.parse(await res.json());
}

export async function deleteCampaign(id: string): Promise<void> {
  const res = await authedFetch(`/api/campaigns/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`delete campaign ${res.status}`);
}

export async function fetchCampaignMembers(id: string): Promise<CampaignMembersResponse> {
  const res = await authedFetch(`/api/campaigns/${id}/members`);
  if (!res.ok) throw new Error(`campaign members ${res.status}`);
  return CampaignMembersResponse.parse(await res.json());
}

export async function inviteCampaignMember(id: string, email: string): Promise<CampaignInvitationResponse> {
  const res = await authedFetch(`/api/campaigns/${id}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `invite member ${res.status}`);
  }
  return CampaignInvitationResponse.parse(await res.json());
}

export async function removeCampaignMember(campaignId: string, userId: string): Promise<void> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/members/${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`remove member ${res.status}`);
}

// ─── Locations ───────────────────────────────────────────────────────────────

export async function fetchLocations(
  campaignId: string,
  viewMode: ViewMode,
): Promise<LocationsResponse> {
  const res = await authedFetch(
    `/api/campaigns/${campaignId}/locations${viewQuery(viewMode)}`,
  );
  if (!res.ok) throw new Error(`locations ${res.status}`);
  return LocationsResponse.parse(await res.json());
}

export async function fetchLocation(
  campaignId: string,
  locationId: string,
  viewMode: ViewMode,
): Promise<LocationResponse> {
  const res = await authedFetch(
    `/api/campaigns/${campaignId}/locations/${locationId}${viewQuery(viewMode)}`,
  );
  if (!res.ok) throw new Error(`location ${res.status}`);
  return LocationResponse.parse(await res.json());
}

export async function createLocation(
  campaignId: string,
  data: LocationCreate,
): Promise<LocationResponse> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/locations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`create location ${res.status}`);
  return LocationResponse.parse(await res.json());
}

export async function updateLocation(
  campaignId: string,
  locationId: string,
  data: LocationUpdate,
): Promise<LocationResponse> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/locations/${locationId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`update location ${res.status}`);
  return LocationResponse.parse(await res.json());
}

export async function deleteLocation(
  campaignId: string,
  locationId: string,
): Promise<void> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/locations/${locationId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`delete location ${res.status}`);
}

// ─── NPCs ────────────────────────────────────────────────────────────────────

export async function fetchNpcs(
  campaignId: string,
  viewMode: ViewMode,
): Promise<NpcsResponse> {
  const res = await authedFetch(
    `/api/campaigns/${campaignId}/npcs${viewQuery(viewMode)}`,
  );
  if (!res.ok) throw new Error(`npcs ${res.status}`);
  return NpcsResponse.parse(await res.json());
}

export async function fetchNpc(
  campaignId: string,
  npcId: string,
  viewMode: ViewMode,
): Promise<NpcResponse> {
  const res = await authedFetch(
    `/api/campaigns/${campaignId}/npcs/${npcId}${viewQuery(viewMode)}`,
  );
  if (!res.ok) throw new Error(`npc ${res.status}`);
  return NpcResponse.parse(await res.json());
}

export async function createNpc(
  campaignId: string,
  data: NpcCreate,
): Promise<NpcResponse> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/npcs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`create npc ${res.status}`);
  return NpcResponse.parse(await res.json());
}

export async function updateNpc(
  campaignId: string,
  npcId: string,
  data: NpcUpdate,
): Promise<NpcResponse> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/npcs/${npcId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`update npc ${res.status}`);
  return NpcResponse.parse(await res.json());
}

export async function deleteNpc(
  campaignId: string,
  npcId: string,
): Promise<void> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/npcs/${npcId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`delete npc ${res.status}`);
}

// ─── Sessions ──────────────────────────────────────────────────────────────────

export async function fetchSessions(campaignId: string, viewMode: ViewMode): Promise<SessionsResponse> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/sessions${viewQuery(viewMode)}`);
  if (!res.ok) throw new Error(`sessions ${res.status}`);
  return SessionsResponse.parse(await res.json());
}

export async function fetchSession(campaignId: string, sessionId: string, viewMode: ViewMode): Promise<SessionResponse> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/sessions/${sessionId}${viewQuery(viewMode)}`);
  if (!res.ok) throw new Error(`session ${res.status}`);
  return SessionResponse.parse(await res.json());
}

export async function createSession(campaignId: string, data: SessionCreate): Promise<SessionResponse> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`create session ${res.status}`);
  return SessionResponse.parse(await res.json());
}

export async function updateSession(campaignId: string, sessionId: string, data: SessionUpdate): Promise<SessionResponse> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`update session ${res.status}`);
  return SessionResponse.parse(await res.json());
}

export async function deleteSession(campaignId: string, sessionId: string): Promise<void> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`delete session ${res.status}`);
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export async function generateCampaignAi(
  req: GenerateCampaignRequest,
): Promise<GenerateCampaignResponse> {
  const res = await authedFetch('/api/ai/generate-campaign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `generate campaign ${res.status}`);
  }
  return GenerateCampaignResponse.parse(await res.json());
}

export async function generateFieldAi(
  req: GenerateFieldRequest,
): Promise<GenerateFieldResponse> {
  const res = await authedFetch('/api/ai/generate-field', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `generate field ${res.status}`);
  }
  return GenerateFieldResponse.parse(await res.json());
}

export async function fetchCampaignInvitations(campaignId: string): Promise<CampaignPendingInvitationsResponse> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/invitations`);
  if (!res.ok) throw new Error(`campaign invitations ${res.status}`);
  return CampaignPendingInvitationsResponse.parse(await res.json());
}

export async function fetchMyInvitations(): Promise<CampaignInvitationsResponse> {
  const res = await authedFetch('/api/invitations');
  if (!res.ok) throw new Error(`invitations ${res.status}`);
  return CampaignInvitationsResponse.parse(await res.json());
}

export async function acceptInvitation(id: string): Promise<void> {
  const res = await authedFetch(`/api/invitations/${id}/accept`, { method: 'POST' });
  if (!res.ok) throw new Error(`accept invitation ${res.status}`);
}

export async function declineInvitation(id: string): Promise<void> {
  const res = await authedFetch(`/api/invitations/${id}/decline`, { method: 'POST' });
  if (!res.ok) throw new Error(`decline invitation ${res.status}`);
}
