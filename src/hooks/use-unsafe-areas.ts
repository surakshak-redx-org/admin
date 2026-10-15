'use client';

import {
  useMutation,
  type UseMutationResult,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { QUERY_ALWAYS_STALE_TIME_MS } from '@/constants/config';
import { QUERY_KEYS } from '@/hooks/query-keys';
import { useAuth } from '@/lib/auth/session';
import {
  executeUnsafeAreaAction,
  getUnsafeAreaDetail,
  getUnsafeAreas,
  type UnsafeAreaDetailResponse,
  type UnsafeAreaWithId,
} from '@/services/unsafe-areas.service';
import type { UnsafeAreaStatus } from '@/types/firestore.types';

export interface UnsafeAreaActionVariables {
  id: string;
  action: 'approve' | 'reject';
}

export interface UnsafeAreaActionResult {
  id: string;
  status?: string;
  deleted?: boolean;
}

/**
 * Custom hook to query submitted unsafe areas with optional status filtering.
 *
 * @param status Status filter ('pending', 'approved', 'rejected', or 'all')
 * @param cursor Optional pagination cursor
 * @returns React Query result with array of unsafe areas
 */
export function useUnsafeAreasQuery(
  status: UnsafeAreaStatus | 'all' = 'all',
  cursor?: string | null,
): UseQueryResult<UnsafeAreaWithId[], Error> {
  const { idToken } = useAuth();

  return useQuery<UnsafeAreaWithId[], Error>({
    queryKey: QUERY_KEYS.unsafeAreas.list(status, cursor),
    queryFn: (): Promise<UnsafeAreaWithId[]> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return getUnsafeAreas(idToken, {
        status,
        cursor: cursor ?? undefined,
      });
    },
    enabled: idToken !== null,
    staleTime: QUERY_ALWAYS_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * Custom hook to query details of a specific unsafe area.
 *
 * @param id Document ID of unsafe area
 * @returns React Query result with unsafe area details and reporter metadata
 */
export function useUnsafeAreaDetailQuery(
  id: string | null,
): UseQueryResult<UnsafeAreaDetailResponse, Error> {
  const { idToken } = useAuth();

  return useQuery<UnsafeAreaDetailResponse, Error>({
    queryKey: QUERY_KEYS.unsafeAreas.detail(id ?? ''),
    queryFn: (): Promise<UnsafeAreaDetailResponse> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      if (!id) {
        throw new Error('Unsafe area ID is required');
      }
      return getUnsafeAreaDetail(idToken, id);
    },
    enabled: idToken !== null && id !== null && id !== '',
  });
}

/**
 * Custom mutation hook to approve or reject a submitted unsafe area report.
 * Automatically invalidates unsafe areas and dashboard stats, and displays toasts.
 *
 * @returns React Query mutation result
 */
export function useUnsafeAreaActionMutation(): UseMutationResult<
  UnsafeAreaActionResult,
  Error,
  UnsafeAreaActionVariables
> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<UnsafeAreaActionResult, Error, UnsafeAreaActionVariables>({
    mutationFn: (variables: UnsafeAreaActionVariables): Promise<UnsafeAreaActionResult> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return executeUnsafeAreaAction(idToken, variables.id, variables.action);
    },
    onSuccess: (_data: UnsafeAreaActionResult, variables: UnsafeAreaActionVariables): void => {
      toast.success(
        variables.action === 'approve' ? 'Area approved and visible on map' : 'Report rejected',
      );
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.unsafeAreas.all });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
    onError: (error: Error): void => {
      toast.error(error.message || 'Failed to update unsafe area');
    },
  });
}
