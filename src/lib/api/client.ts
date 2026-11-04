import { SESSION_ENDED_ERROR } from '@/constants/config';
import { getClientAuth } from '@/lib/firebase/client';
import type { ApiResult } from '@/types/api.types';

/**
 * Client-side fetch helper for the admin API routes — attaches the Firebase ID token.
 * Refuses to send once this tab has no signed-in user (e.g. the admin signed out in
 * another tab), so a token still held by a mounted component cannot be used after logout.
 */
export async function apiFetch<T>(path: string, idToken: string, init?: RequestInit): Promise<T> {
  if (getClientAuth().currentUser === null) throw new Error(SESSION_ENDED_ERROR);

  const response = await fetch(path, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${idToken}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  const body = (await response.json()) as ApiResult<T>;
  if (body.error !== null) throw new Error(body.error);
  return body.data;
}
