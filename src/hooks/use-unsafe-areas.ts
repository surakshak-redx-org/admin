import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { QUERY_CONFIG } from '@/constants/config';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import type { Serialized } from '@/types/api.types';
import type { UnsafeArea, UnsafeAreaStatus } from '@/types/firestore.types';

export type ClientUnsafeArea = Serialized<UnsafeArea> & { id: string };

export interface UseUnsafeAreasParams {
  status?: UnsafeAreaStatus | 'all';
  limit?: number;
  cursor?: string;
}

export type UseUnsafeAreasInput = UseUnsafeAreasParams | UnsafeAreaStatus | 'all';

function normalizeParams(params?: UseUnsafeAreasInput): UseUnsafeAreasParams {
  if (typeof params === 'string') {
    return { status: params };
  }
  return params ?? {};
}

function buildQueryString(params: UseUnsafeAreasParams): string {
  const searchParams = new URLSearchParams();
  if (params.status && params.status !== 'all') {
    searchParams.set('status', params.status);
  }
  if (params.limit !== undefined) {
    searchParams.set('limit', String(params.limit));
  }
  if (params.cursor) {
    searchParams.set('cursor', params.cursor);
  }
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

export function useUnsafeAreas(
  params?: UseUnsafeAreasInput,
): UseQueryResult<ClientUnsafeArea[], Error> {
  const { idToken } = useAuth();
  const normalizedParams = normalizeParams(params);

  return useQuery({
    queryKey: ['unsafe-areas', normalizedParams],
    queryFn: () =>
      apiFetch<ClientUnsafeArea[]>(
        `/api/unsafe-areas${buildQueryString(normalizedParams)}`,
        idToken ?? '',
      ),
    enabled: !!idToken,
    staleTime: QUERY_CONFIG.LIVE_QUEUE_STALE_TIME,
    refetchOnWindowFocus: true,
  });
}
