import { HealthResponse } from '@tabletop/shared';

const baseUrl = import.meta.env.VITE_API_URL ?? '';

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${baseUrl}/health`);
  if (!res.ok) throw new Error(`health ${res.status}`);
  return HealthResponse.parse(await res.json());
}
