import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { QUERY_CONFIG } from '@/constants/config';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import type { Serialized } from '@/types/api.types';
import type { IncidentReport, IncidentStatus, SurakshakUser } from '@/types/firestore.types';

export type IncidentWithUser = Serialized<IncidentReport> & {
  id: string;
  user: Pick<SurakshakUser, 'name' | 'city'> | null;
};

export type ClientIncident = IncidentWithUser;

export interface UseIncidentsParams {
  status?: IncidentStatus | 'all';
  limit?: number;
  cursor?: string;
}

export type UseIncidentsInput = UseIncidentsParams | IncidentStatus | 'all';

function normalizeParams(params?: UseIncidentsInput): UseIncidentsParams {
  if (typeof params === 'string') {
    return { status: params };
  }
  return params ?? {};
}

function buildQueryString(params: UseIncidentsParams): string {
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

export function useIncidents(
  params?: UseIncidentsInput,
): UseQueryResult<IncidentWithUser[], Error> {
  const { idToken } = useAuth();
  const normalizedParams = normalizeParams(params);

  return useQuery({
    queryKey: ['incidents', normalizedParams],
    queryFn: () =>
      apiFetch<IncidentWithUser[]>(
        `/api/incidents${buildQueryString(normalizedParams)}`,
        idToken ?? '',
      ),
    enabled: !!idToken,
    staleTime: QUERY_CONFIG.LIVE_QUEUE_STALE_TIME,
    refetchOnWindowFocus: true,
  });
}
