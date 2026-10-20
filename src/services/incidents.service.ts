import { apiFetch } from '@/lib/api/client';
import type { Serialized } from '@/types/api.types';
import type { IncidentReport, IncidentStatus, SurakshakUser } from '@/types/firestore.types';

export type IncidentWithUser = Serialized<IncidentReport> & {
  id: string;
  user: Pick<SurakshakUser, 'name' | 'city'> | null;
};

export interface GetIncidentsParams {
  status?: IncidentStatus | 'all' | 'unresolved';
  limit?: number;
  cursor?: string | null;
}

export interface IncidentDetailResponse {
  report: Serialized<IncidentReport>;
  user: Pick<SurakshakUser, 'name' | 'city'> | null;
  mapUrl: string;
}

/** Minimal incident data shown in a "new incident" notification. */
export interface NewIncidentSummary {
  id: string;
  title: string;
  reporterName: string | null;
  createdAt: string;
}

export interface LatestIncidentsResponse {
  incidents: NewIncidentSummary[];
  /** Pass back as `since` on the next call. */
  cursor: string;
}

export interface UpdateIncidentPayload {
  status: IncidentStatus;
  adminNote?: string;
}

/**
 * Lists incident reports with optional status filtering.
 *
 * @param idToken Firebase ID token for authentication
 * @param params Filter and pagination options
 * @returns Array of incident reports joined with reporter metadata
 */
export async function getIncidents(
  idToken: string,
  params?: GetIncidentsParams,
): Promise<IncidentWithUser[]> {
  const searchParams = new URLSearchParams();
  if (params?.status && params.status !== 'all') {
    searchParams.set('status', params.status);
  }
  if (params?.limit !== undefined && params?.limit !== null) {
    searchParams.set('limit', String(params.limit));
  }
  if (params?.cursor) {
    searchParams.set('cursor', params.cursor);
  }
  const queryString = searchParams.toString();
  const path = queryString ? `/api/incidents?${queryString}` : '/api/incidents';
  return apiFetch<IncidentWithUser[]>(path, idToken);
}

/**
 * Retrieves full details for a single incident report, including reporter info and map URL.
 *
 * @param idToken Firebase ID token for authentication
 * @param id Incident report document ID
 * @returns Incident detail response
 */
export async function getIncidentDetail(
  idToken: string,
  id: string,
): Promise<IncidentDetailResponse> {
  return apiFetch<IncidentDetailResponse>(`/api/incidents/${encodeURIComponent(id)}`, idToken);
}

export const getIncident = getIncidentDetail;

/**
 * Updates an incident report's status and optional admin note.
 *
 * @param idToken Firebase ID token for authentication
 * @param id Incident report document ID
 * @param payload Update data containing new status and optional adminNote
 * @returns Updated incident report ID and status
 */
export async function updateIncident(
  idToken: string,
  id: string,
  payload: UpdateIncidentPayload,
): Promise<{ id: string; status: IncidentStatus }> {
  return apiFetch<{ id: string; status: IncidentStatus }>(
    `/api/incidents/${encodeURIComponent(id)}`,
    idToken,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Polls for incident reports created after `since`. Without `since` the server
 * only returns a starting cursor (no incidents), so reports that already exist
 * are never announced as new.
 *
 * @param idToken Firebase ID token for authentication
 * @param since Cursor returned by the previous call, or null for the first call
 * @returns New incident summaries (newest first) and the cursor for the next call
 */
export async function getLatestIncidents(
  idToken: string,
  since: string | null,
): Promise<LatestIncidentsResponse> {
  const path = since
    ? `/api/incidents/latest?since=${encodeURIComponent(since)}`
    : '/api/incidents/latest';
  return apiFetch<LatestIncidentsResponse>(path, idToken);
}
