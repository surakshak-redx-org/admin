'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { NEW_INCIDENT_POLL_INTERVAL_MS, QUERY_ALWAYS_STALE_TIME_MS } from '@/constants/config';
import { QUERY_KEYS } from '@/hooks/query-keys';
import { useAuth } from '@/lib/auth/session';
import {
  getLatestIncidents,
  type LatestIncidentsResponse,
  type NewIncidentSummary,
} from '@/services/incidents.service';

/**
 * Polls for incident reports submitted after the admin opened the dashboard.
 * The first poll only sets a starting point, so existing reports never trigger
 * a notification. When new reports arrive, the incident lists and dashboard
 * stats are refetched so they update without a manual refresh.
 *
 * @returns The new incidents from the latest poll (undefined until the first poll finishes)
 */
export function useNewIncidentPoll(): NewIncidentSummary[] | undefined {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();
  const cursorRef = useRef<string | null>(null);

  const query = useQuery<LatestIncidentsResponse, Error>({
    queryKey: QUERY_KEYS.incidents.latest,
    queryFn: async (): Promise<LatestIncidentsResponse> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      const response = await getLatestIncidents(idToken, cursorRef.current);
      cursorRef.current = response.cursor;

      if (response.incidents.length > 0) {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.incidents.lists() });
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.incidents.recent });
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
      }
      return response;
    },
    enabled: idToken !== null,
    staleTime: QUERY_ALWAYS_STALE_TIME_MS,
    refetchInterval: NEW_INCIDENT_POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  return query.data?.incidents;
}
