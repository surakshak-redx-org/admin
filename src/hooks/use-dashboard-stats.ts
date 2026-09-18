import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import type { DashboardStats } from '@/types/firestore.types';

export function useDashboardStats(): UseQueryResult<DashboardStats, Error> {
  const { idToken } = useAuth();

  return useQuery({
    queryKey: ['stats'],
    queryFn: () => apiFetch<DashboardStats>('/api/stats', idToken ?? ''),
    enabled: !!idToken,
  });
}
