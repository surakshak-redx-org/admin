'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/hooks/query-keys';
import { useAuth } from '@/lib/auth/session';
import { getStats } from '@/services/stats.service';
import type { DashboardStats } from '@/types/firestore.types';

/**
 * Custom hook to query aggregated dashboard metrics from `/api/stats`.
 * Automatically manages authentication state via `useAuth` and enables
 * execution only when a valid Firebase ID token is available.
 *
 * @returns React Query result containing DashboardStats
 */
export function useStatsQuery(): UseQueryResult<DashboardStats, Error> {
  const { idToken } = useAuth();

  return useQuery<DashboardStats, Error>({
    queryKey: QUERY_KEYS.stats,
    queryFn: (): Promise<DashboardStats> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return getStats(idToken);
    },
    enabled: idToken !== null,
  });
}
