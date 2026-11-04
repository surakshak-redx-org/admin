import { apiFetch } from '@/lib/api/client';
import type { Serialized } from '@/types/api.types';
import type { CommunityPost } from '@/types/firestore.types';

export type ModerationPost = Serialized<CommunityPost> & { id: string };

export interface GetModerationParams {
  limit?: number;
  cursor?: string | null;
}

export interface ModerationActionPayload {
  action: 'restore' | 'delete';
  reason?: string;
}

/**
 * Lists hidden community posts pending moderation review.
 *
 * @param idToken Firebase ID token for authentication
 * @param params Optional pagination parameters
 * @returns Array of moderation posts
 */
export async function getModerationPosts(
  idToken: string,
  params?: GetModerationParams,
): Promise<ModerationPost[]> {
  const searchParams = new URLSearchParams();
  if (params?.limit !== undefined && params?.limit !== null) {
    searchParams.set('limit', String(params.limit));
  }
  if (params?.cursor) {
    searchParams.set('cursor', params.cursor);
  }
  const queryString = searchParams.toString();
  const path = queryString ? `/api/moderation?${queryString}` : '/api/moderation';
  return apiFetch<ModerationPost[]>(path, idToken);
}

/**
 * Retrieves single community post under moderation.
 *
 * @param idToken Firebase ID token for authentication
 * @param id Post document ID
 * @returns Moderation post detail
 */
export async function getModerationPost(idToken: string, id: string): Promise<ModerationPost> {
  return apiFetch<ModerationPost>(`/api/moderation/${encodeURIComponent(id)}`, idToken);
}

/**
 * Executes a moderation action (restore or permanently delete) on a flagged post.
 *
 * @param idToken Firebase ID token for authentication
 * @param id Post document ID
 * @param action Action to perform ('restore' or 'delete')
 * @param reason Why the post is deleted; required by the API for 'delete'
 * @returns Action result confirmation
 */
export async function executeModerationAction(
  idToken: string,
  id: string,
  action: 'restore' | 'delete',
  reason?: string,
): Promise<{ id: string; restored?: boolean; deleted?: boolean }> {
  return apiFetch<{ id: string; restored?: boolean; deleted?: boolean }>(
    `/api/moderation/${encodeURIComponent(id)}`,
    idToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ action, reason }),
    },
  );
}

export const moderationAction = executeModerationAction;
