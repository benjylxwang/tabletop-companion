import {
  CampaignCreate,
  CampaignUpdate,
  CampaignMemberResponse,
  CampaignMembersResponse,
  CampaignResponse,
  CampaignsResponse,
  FactionCreate,
  FactionUpdate,
  FactionResponse,
  FactionsResponse,
  HealthResponse,
  MeResponse,
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

export async function addCampaignMember(id: string, email: string): Promise<CampaignMemberResponse> {
  const res = await authedFetch(`/api/campaigns/${id}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `add member ${res.status}`);
  }
  return CampaignMemberResponse.parse(await res.json());
}

export async function removeCampaignMember(campaignId: string, userId: string): Promise<void> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/members/${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`remove member ${res.status}`);
}

// ─── Factions ────────────────────────────────────────────────────────────────

export async function fetchFactions(campaignId: string, viewMode: ViewMode): Promise<FactionsResponse> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/factions${viewQuery(viewMode)}`);
  if (!res.ok) throw new Error(`factions ${res.status}`);
  return FactionsResponse.parse(await res.json());
}

export async function fetchFaction(campaignId: string, factionId: string, viewMode: ViewMode): Promise<FactionResponse> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/factions/${factionId}${viewQuery(viewMode)}`);
  if (!res.ok) throw new Error(`faction ${res.status}`);
  return FactionResponse.parse(await res.json());
}

export async function createFaction(campaignId: string, data: FactionCreate): Promise<FactionResponse> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/factions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`create faction ${res.status}`);
  return FactionResponse.parse(await res.json());
}

export async function updateFaction(campaignId: string, factionId: string, data: FactionUpdate): Promise<FactionResponse> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/factions/${factionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`update faction ${res.status}`);
  return FactionResponse.parse(await res.json());
}

export async function deleteFaction(campaignId: string, factionId: string): Promise<void> {
  const res = await authedFetch(`/api/campaigns/${campaignId}/factions/${factionId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`delete faction ${res.status}`);
}
