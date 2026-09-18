import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { QUERY_CONFIG } from '@/constants/config';
import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';
import type { Serialized } from '@/types/api.types';
import type { CommunityPost } from '@/types/firestore.types';

export type ModerationPost = Serialized<CommunityPost> & { id: string };

export type ClientPost = ModerationPost;

export interface UseModerationParams {
  limit?: number;
  cursor?: string;
}

function buildQueryString(params?: UseModerationParams): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  if (params.limit !== undefined) {
    searchParams.set('limit', String(params.limit));
  }
  if (params.cursor) {
    searchParams.set('cursor', params.cursor);
  }
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

export function useModeration(
  params?: UseModerationParams,
): UseQueryResult<ModerationPost[], Error> {
  const { idToken } = useAuth();

  return useQuery({
    queryKey: ['moderation', params],
    queryFn: () =>
      apiFetch<ModerationPost[]>(
        `/api/moderation${buildQueryString(params)}`,
        idToken ?? '',
      ),
    enabled: !!idToken,
    staleTime: QUERY_CONFIG.LIVE_QUEUE_STALE_TIME,
    refetchOnWindowFocus: true,
  });
}
