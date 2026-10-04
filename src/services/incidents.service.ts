import { apiFetch } from '@/lib/api/client';
import type { Serialized } from '@/types/api.types';
import type { IncidentReport, IncidentStatus, SurakshakUser } from '@/types/firestore.types';

export type IncidentWithUser = Serialized<IncidentReport> & {
  id: string;
  user: Pick<SurakshakUser, 'name' | 'city'> | null;
};

export interface GetIncidentsParams {
  status?: IncidentStatus | 'all';
  limit?: number;
  cursor?: string | null;
}

export interface IncidentDetailResponse {
  report: Serialized<IncidentReport>;
  user: Pick<SurakshakUser, 'name' | 'city'> | null;
  mapUrl: string;
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
