import { apiFetch } from '@/lib/api/client';
import type { Serialized } from '@/types/api.types';
import type { AdminUser } from '@/types/firestore.types';

export type AdminUserWithId = Serialized<AdminUser>;

export interface GetAdminsParams {
  limit?: number;
}

/**
 * Retrieves all registered dashboard administrators. Requires super_admin role.
 *
 * @param idToken Firebase ID token for authentication
 * @param params Optional pagination parameters
 * @returns Array of admin users
 */
export async function getAdmins(
  idToken: string,
  params?: GetAdminsParams,
): Promise<AdminUserWithId[]> {
  const searchParams = new URLSearchParams();
  if (params?.limit !== undefined && params?.limit !== null) {
    searchParams.set('limit', String(params.limit));
  }
  const queryString = searchParams.toString();
  const path = queryString ? `/api/admins?${queryString}` : '/api/admins';
  return apiFetch<AdminUserWithId[]>(path, idToken);
}

/**
 * Adds a new admin user by existing user account email. Requires super_admin role.
 *
 * @param idToken Firebase ID token for authentication
 * @param email Email address of user to promote to admin
 * @returns Created admin user record
 */
export async function addAdmin(idToken: string, email: string): Promise<AdminUserWithId> {
  return apiFetch<AdminUserWithId>('/api/admins', idToken, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/**
 * Removes administrative privileges for a user. Requires super_admin role.
 *
 * @param idToken Firebase ID token for authentication
 * @param uid Firebase UID of administrator to remove
 * @returns Removal confirmation
 */
export async function removeAdmin(
  idToken: string,
  uid: string,
): Promise<{ uid: string; removed: boolean }> {
  return apiFetch<{ uid: string; removed: boolean }>(
    `/api/admins/${encodeURIComponent(uid)}`,
    idToken,
    {
      method: 'DELETE',
    },
  );
}
