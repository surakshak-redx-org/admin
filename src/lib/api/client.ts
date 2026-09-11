import type { ApiResult } from '@/types/api.types';

/** Client-side fetch helper for the admin API routes — attaches the Firebase ID token. */
export async function apiFetch<T>(path: string, idToken: string, init?: RequestInit): Promise<T> {
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
