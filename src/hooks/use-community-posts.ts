import type {
  DefinedInitialDataInfiniteOptions,
  InfiniteData,
  UseInfiniteQueryResult,
  UseMutationResult,
} from '@tanstack/react-query';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { QUERY_KEYS } from '@/hooks/query-keys';
import { useAuth } from '@/lib/auth/session';
import type { CommunityPostsResponse } from '@/services/community-posts.service';
import { deleteCommunityPost, getCommunityPosts } from '@/services/community-posts.service';

/**
 * Custom hook to fetch infinite paginated community posts.
 *
 * @param sort Sort order ('newest' | 'oldest' | 'most_reported')
 * @param status Status filter ('all' | 'visible' | 'hidden')
 * @returns Infinite query result containing paginated community posts
 */
export function useCommunityPostsInfiniteQuery(
  sort: string,
  status: string,
): UseInfiniteQueryResult<InfiniteData<CommunityPostsResponse, string | null>, Error> {
  const { idToken } = useAuth();

  return useInfiniteQuery({
    queryKey: QUERY_KEYS.communityPosts.list(sort, status),
    queryFn: ({ pageParam }: { pageParam: string | null }): Promise<CommunityPostsResponse> =>
      getCommunityPosts(idToken ?? '', { sort, status, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: CommunityPostsResponse): string | null =>
      lastPage.nextCursor ?? null,
    enabled: idToken !== null,
  } as unknown as DefinedInitialDataInfiniteOptions<
    CommunityPostsResponse,
    Error,
    InfiniteData<CommunityPostsResponse, string | null>,
    ReturnType<typeof QUERY_KEYS.communityPosts.list>,
    string | null
  >);
}

/**
 * Mutation hook to permanently delete a community post.
 * Invalidates communityPosts, moderation, and stats queries.
 *
 * @returns React Query mutation result
 */
export function useDeleteCommunityPostMutation(): UseMutationResult<
  { id: string; deleted: boolean },
  Error,
  string
> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string): Promise<{ id: string; deleted: boolean }> =>
      deleteCommunityPost(idToken ?? '', id),
    onSuccess: (): void => {
      toast.success('Post permanently deleted');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.communityPosts.all });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.moderation.all });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
    onError: (): void => {
      toast.error('Failed to delete post');
    },
  });
}
