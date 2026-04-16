import { useQuery } from '@tanstack/react-query';
import { getSignedUrl } from './api';

// API-side TTL is 60 minutes. Refresh a few minutes before expiry so a long
// session doesn't hit a dead URL mid-render.
const STALE_TIME_MS = 55 * 60 * 1000;

export interface UseSignedUrlResult {
  url: string | null;
  isLoading: boolean;
  error: Error | null;
}

// Resolves an opaque storage path (persisted in `*_url` columns) to a fresh
// signed URL for display. Callers pass `null`/`undefined` when the parent row
// has no file, and the hook no-ops.
export function useSignedUrl(path: string | null | undefined): UseSignedUrlResult {
  const enabled = Boolean(path);
  const { data, isLoading, error } = useQuery({
    queryKey: ['signed-url', path],
    queryFn: () => getSignedUrl(path!),
    enabled,
    staleTime: STALE_TIME_MS,
    // A 401/network hiccup shouldn't trigger a refresh storm.
    retry: 1,
  });

  return {
    url: data?.url ?? null,
    isLoading: enabled && isLoading,
    error: (error as Error | null) ?? null,
  };
}
