'use client';

import {
  useMutation,
  type UseMutationResult,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { QUERY_ALWAYS_STALE_TIME_MS } from '@/constants/config';
import { QUERY_KEYS } from '@/hooks/query-keys';
import { useAuth } from '@/lib/auth/session';
import {
  executeModerationAction,
  getModerationPosts,
  type ModerationPost,
} from '@/services/moderation.service';

export interface ModerationActionVariables {
  id: string;
  action: 'restore' | 'delete';
}

export interface ModerationActionResult {
  id: string;
  restored?: boolean;
  deleted?: boolean;
}

/**
 * Custom hook to query hidden community posts pending moderation review.
 *
 * @param cursor Optional pagination cursor
 * @param limit Optional page size limit
 * @returns React Query result with array of moderation posts
 */
export function useModerationPostsQuery(
  cursor?: string | null,
  limit?: number,
): UseQueryResult<ModerationPost[], Error> {
  const { idToken } = useAuth();

  return useQuery<ModerationPost[], Error>({
    queryKey: QUERY_KEYS.moderation.list(cursor),
    queryFn: (): Promise<ModerationPost[]> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return getModerationPosts(idToken, {
        cursor: cursor ?? undefined,
        limit,
      });
    },
    enabled: idToken !== null,
    staleTime: QUERY_ALWAYS_STALE_TIME_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * Custom mutation hook to execute a moderation action (restore or permanently delete) on a post.
 * Automatically invalidates moderation queue, community posts, and dashboard stats queries.
 *
 * @returns React Query mutation result
 */
export function useModerationActionMutation(): UseMutationResult<
  ModerationActionResult,
  Error,
  ModerationActionVariables
> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<ModerationActionResult, Error, ModerationActionVariables>({
    mutationFn: (variables: ModerationActionVariables): Promise<ModerationActionResult> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return executeModerationAction(idToken, variables.id, variables.action);
    },
    onSuccess: (_data: ModerationActionResult, variables: ModerationActionVariables): void => {
      toast.success(
        variables.action === 'restore'
          ? 'Post restored and visible again'
          : 'Post permanently deleted',
      );
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.moderation.all });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.communityPosts.all });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
    onError: (error: Error): void => {
      toast.error(error.message || 'Failed to update post');
    },
  });
}
