import { apiFetch } from '@/lib/api/client';
import type { Serialized } from '@/types/api.types';
import type { CommunityPost } from '@/types/firestore.types';

export type CommunityPostWithId = Serialized<CommunityPost> & { id: string };

export interface GetCommunityPostsParams {
  sort?: string;
  status?: string;
  cursor?: string | null;
}

export interface CommunityPostsResponse {
  posts: CommunityPostWithId[];
  nextCursor: string | null;
}

/**
 * Fetches paginated community posts with sorting and status filters.
 *
 * @param idToken Firebase ID token for authentication
 * @param params Query filtering and sorting options
 * @returns Paginated list of community posts with next cursor
 */
export async function getCommunityPosts(
  idToken: string,
  params?: GetCommunityPostsParams,
): Promise<CommunityPostsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.sort) {
    searchParams.set('sort', params.sort);
  }
  if (params?.status) {
    searchParams.set('status', params.status);
  }
  if (params?.cursor) {
    searchParams.set('cursor', params.cursor);
  }

  const queryString = searchParams.toString();
  const path = queryString ? `/api/community-posts?${queryString}` : '/api/community-posts';
  return apiFetch<CommunityPostsResponse>(path, idToken);
}

/**
 * Permanently deletes a community post.
 *
 * @param idToken Firebase ID token for authentication
 * @param id Post document ID
 * @returns Deletion confirmation
 */
export async function deleteCommunityPost(
  idToken: string,
  id: string,
): Promise<{ id: string; deleted: boolean }> {
  return apiFetch<{ id: string; deleted: boolean }>(
    `/api/community-posts/${encodeURIComponent(id)}`,
    idToken,
    {
      method: 'DELETE',
    },
  );
}
