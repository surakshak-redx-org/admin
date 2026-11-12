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
  getIncidentDetail,
  getIncidents,
  type IncidentDetailResponse,
  type IncidentWithUser,
  updateIncident,
} from '@/services/incidents.service';
import type { IncidentStatus } from '@/types/firestore.types';

export interface UpdateIncidentVariables {
  id: string;
  status: IncidentStatus;
  adminNote?: string;
}

export interface UpdateIncidentResult {
  id: string;
  status: IncidentStatus;
}

/**
 * Custom hook to query incident reports filtered by status with optional cursor pagination.
 *
 * @param status Filter reports by status, or 'all'
 * @param cursor Optional pagination cursor
 * @returns React Query result with list of incident reports joined with reporter metadata
 */
export function useIncidentsQuery(
  status: IncidentStatus | 'all' = 'all',
  cursor?: string | null,
): UseQueryResult<IncidentWithUser[], Error> {
  const { idToken } = useAuth();

  return useQuery<IncidentWithUser[], Error>({
    queryKey: QUERY_KEYS.incidents.list(status, cursor),
    queryFn: (): Promise<IncidentWithUser[]> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return getIncidents(idToken, {
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
 * Custom hook to query recent incidents for the dashboard summary widget.
 *
 * @param limit Number of incidents to fetch (defaults to 10)
 * @returns React Query result with recent incident reports
 */
export function useRecentIncidentsQuery(
  limit: number = 10,
): UseQueryResult<IncidentWithUser[], Error> {
  const { idToken } = useAuth();

  return useQuery<IncidentWithUser[], Error>({
    queryKey: QUERY_KEYS.incidents.recent,
    queryFn: (): Promise<IncidentWithUser[]> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return getIncidents(idToken, { limit });
    },
    enabled: idToken !== null,
  });
}

/**
 * Custom hook to query detailed data for a single incident report.
 *
 * @param id Document ID of the incident report
 * @returns React Query result with report details, reporter metadata, and map URL
 */
export function useIncidentDetailQuery(
  id: string | null,
): UseQueryResult<IncidentDetailResponse, Error> {
  const { idToken } = useAuth();

  return useQuery<IncidentDetailResponse, Error>({
    queryKey: QUERY_KEYS.incidents.detail(id ?? ''),
    queryFn: (): Promise<IncidentDetailResponse> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      if (!id) {
        throw new Error('Incident ID is required');
      }
      return getIncidentDetail(idToken, id);
    },
    enabled: idToken !== null && id !== null && id !== '',
  });
}

/**
 * Custom mutation hook to update an incident report's status and admin note.
 * Automatically invalidates incident queries and dashboard stats, and displays toasts.
 *
 * @returns React Query mutation result
 */
export function useUpdateIncidentMutation(): UseMutationResult<
  UpdateIncidentResult,
  Error,
  UpdateIncidentVariables
> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<UpdateIncidentResult, Error, UpdateIncidentVariables>({
    mutationFn: (variables: UpdateIncidentVariables): Promise<UpdateIncidentResult> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      const { id, ...payload } = variables;
      return updateIncident(idToken, id, payload);
    },
    onSuccess: (): void => {
      toast.success('Incident updated');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.incidents.all });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
    onError: (error: Error): void => {
      toast.error(error.message || 'Failed to update incident');
    },
  });
}
