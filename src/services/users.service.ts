import type { UserAction } from '@/constants/config';
import { apiFetch } from '@/lib/api/client';
import type { Serialized } from '@/types/api.types';
import type { SurakshakUser } from '@/types/firestore.types';

export interface GetUsersParams {
  search?: string;
  cursor?: string | null;
  limit?: number;
}

export interface UsersListResponse {
  users: (Serialized<Omit<SurakshakUser, 'phone'>> & { id: string })[];
  nextCursor: string | null;
}

export interface UserDetailResponse {
  user: Serialized<Omit<SurakshakUser, 'phone'>> & { id: string };
  postCount: number;
  incidentCount: number;
}

/**
 * Queries users with optional text search and pagination.
 *
 * @param idToken Firebase ID token for authentication
 * @param params Query parameters (search filter, pagination cursor, and limit)
 * @returns Paginated list of users with next cursor
 */
export async function getUsers(
  idToken: string,
  params?: GetUsersParams,
): Promise<UsersListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.search) {
    searchParams.set('search', params.search);
  }
  if (params?.cursor) {
    searchParams.set('cursor', params.cursor);
  }
  if (params?.limit !== undefined && params?.limit !== null) {
    searchParams.set('limit', String(params.limit));
  }
  const queryString = searchParams.toString();
  const path = queryString ? `/api/users?${queryString}` : '/api/users';
  return apiFetch<UsersListResponse>(path, idToken);
}

/**
 * Retrieves detailed user profile and aggregate activity counts.
 *
 * @param idToken Firebase ID token for authentication
 * @param uid Target user unique identifier
 * @returns User profile details with post and incident counts
 */
export async function getUserDetail(idToken: string, uid: string): Promise<UserDetailResponse> {
  return apiFetch<UserDetailResponse>(`/api/users/${encodeURIComponent(uid)}`, idToken);
}

export interface UserSuspensionResponse {
  id: string;
  isSuspended: boolean;
}

async function patchUserAction(
  idToken: string,
  uid: string,
  action: UserAction,
): Promise<UserSuspensionResponse> {
  return apiFetch<UserSuspensionResponse>(`/api/users/${encodeURIComponent(uid)}`, idToken, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  });
}

/**
 * Suspends a user account.
 *
 * @param idToken Firebase ID token for authentication
 * @param uid Target user unique identifier
 * @returns Updated user id and suspension status
 */
export async function suspendUser(idToken: string, uid: string): Promise<UserSuspensionResponse> {
  return patchUserAction(idToken, uid, 'suspend');
}

/**
 * Restores a suspended user account so they can sign in again.
 *
 * @param idToken Firebase ID token for authentication
 * @param uid Target user unique identifier
 * @returns Updated user id and suspension status
 */
export async function unsuspendUser(idToken: string, uid: string): Promise<UserSuspensionResponse> {
  return patchUserAction(idToken, uid, 'unsuspend');
}
