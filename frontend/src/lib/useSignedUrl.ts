import { useQuery } from '@tanstack/react-query';
import { getSignedUrl } from './api';

// API-side TTL is 60 minutes. Proactively refresh at 55 min both via staleTime
// (triggers on next mount/focus) and refetchInterval (keeps long-lived sessions
// from hitting a dead URL without any user interaction).
const STALE_TIME_MS = 55 * 60 * 1000;
const REFETCH_INTERVAL_MS = 55 * 60 * 1000;

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
    refetchInterval: REFETCH_INTERVAL_MS,
    // A 401/network hiccup shouldn't trigger a refresh storm.
    retry: 1,
  });

  return {
    url: data?.url ?? null,
    isLoading: enabled && isLoading,
    error: (error as Error | null) ?? null,
  };
}
