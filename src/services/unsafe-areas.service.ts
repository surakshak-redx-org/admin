import { apiFetch } from '@/lib/api/client';
import type { Serialized } from '@/types/api.types';
import type { SurakshakUser, UnsafeArea, UnsafeAreaStatus } from '@/types/firestore.types';

export type UnsafeAreaWithId = Serialized<UnsafeArea> & {
  id: string;
  reporterName?: string | null;
};

export interface GetUnsafeAreasParams {
  status?: UnsafeAreaStatus | 'all';
  limit?: number;
  cursor?: string | null;
}

export interface UnsafeAreaDetailResponse {
  area: Serialized<UnsafeArea>;
  reporter: Pick<SurakshakUser, 'name' | 'city'> | null;
}

/**
 * Lists user-submitted unsafe areas with optional status filtering.
 *
 * @param idToken Firebase ID token for authentication
 * @param params Query filtering options
 * @returns Array of unsafe areas
 */
export async function getUnsafeAreas(
  idToken: string,
  params?: GetUnsafeAreasParams,
): Promise<UnsafeAreaWithId[]> {
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
  const path = queryString ? `/api/unsafe-areas?${queryString}` : '/api/unsafe-areas';
  return apiFetch<UnsafeAreaWithId[]>(path, idToken);
}

/**
 * Retrieves details for a specific unsafe area along with reporter profile.
 *
 * @param idToken Firebase ID token for authentication
 * @param id Unsafe area document ID
 * @returns Unsafe area details and reporter metadata
 */
export async function getUnsafeAreaDetail(
  idToken: string,
  id: string,
): Promise<UnsafeAreaDetailResponse> {
  return apiFetch<UnsafeAreaDetailResponse>(`/api/unsafe-areas/${encodeURIComponent(id)}`, idToken);
}

export const getUnsafeArea = getUnsafeAreaDetail;

/**
 * Approves or rejects a submitted unsafe area report.
 *
 * @param idToken Firebase ID token for authentication
 * @param id Unsafe area document ID
 * @param action Approval or rejection action
 * @returns Action status confirmation
 */
export async function executeUnsafeAreaAction(
  idToken: string,
  id: string,
  action: 'approve' | 'reject',
): Promise<{ id: string; status?: string; deleted?: boolean }> {
  return apiFetch<{ id: string; status?: string; deleted?: boolean }>(
    `/api/unsafe-areas/${encodeURIComponent(id)}`,
    idToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    },
  );
}

export const unsafeAreaAction = executeUnsafeAreaAction;
