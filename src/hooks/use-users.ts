'use client';

import {
  useMutation,
  type UseMutationResult,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { SEARCH_DEBOUNCE_MS } from '@/constants/config';
import { QUERY_KEYS } from '@/hooks/query-keys';
import { useAuth } from '@/lib/auth/session';
import {
  getUserDetail,
  getUsers,
  setUserSuspension,
  type UserDetailResponse,
  type UsersListResponse,
} from '@/services/users.service';

/**
 * Utility hook that debounces an input value across render cycles.
 *
 * @param value Current value
 * @param delayMs Debounce delay in milliseconds
 * @returns Debounced value
 */
export function useDebouncedValue<T>(value: T, delayMs: number = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect((): (() => void) => {
    const timer = setTimeout((): void => {
      setDebounced(value);
    }, delayMs);

    return (): void => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debounced;
}

/**
 * Custom hook to query a paginated list of Surakshak users with debounced search.
 *
 * @param search Optional search query string
 * @param cursor Optional pagination cursor
 * @param limit Optional page size limit
 * @param debounceMs Debounce delay for search term (defaults to SEARCH_DEBOUNCE_MS)
 * @returns React Query result with user list and next cursor
 */
export function useUsersListQuery(
  search?: string,
  cursor?: string | null,
  limit?: number,
  debounceMs: number = SEARCH_DEBOUNCE_MS,
): UseQueryResult<UsersListResponse, Error> {
  const { idToken } = useAuth();
  const debouncedSearch = useDebouncedValue(search, debounceMs);
  const effectiveSearch = debounceMs > 0 ? debouncedSearch : search;

  return useQuery<UsersListResponse, Error>({
    queryKey: QUERY_KEYS.users.list(effectiveSearch, cursor, limit),
    queryFn: (): Promise<UsersListResponse> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return getUsers(idToken, {
        search: effectiveSearch?.trim() || undefined,
        cursor: cursor ?? undefined,
        limit,
      });
    },
    enabled: idToken !== null,
  });
}

/**
 * Custom hook to query recent users for the dashboard summary widget.
 *
 * @param limit Number of recent users to fetch (defaults to 5)
 * @returns React Query result with recent users
 */
export function useRecentUsersQuery(limit: number = 5): UseQueryResult<UsersListResponse, Error> {
  const { idToken } = useAuth();

  return useQuery<UsersListResponse, Error>({
    queryKey: QUERY_KEYS.users.recent,
    queryFn: (): Promise<UsersListResponse> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return getUsers(idToken, { limit });
    },
    enabled: idToken !== null,
  });
}

/**
 * Custom hook to query detailed profile and activity counts for a single user.
 *
 * @param uid User ID to fetch details for
 * @returns React Query result with user profile and aggregate counts
 */
export function useUserDetailQuery(uid: string | null): UseQueryResult<UserDetailResponse, Error> {
  const { idToken } = useAuth();

  return useQuery<UserDetailResponse, Error>({
    queryKey: QUERY_KEYS.users.detail(uid ?? ''),
    queryFn: (): Promise<UserDetailResponse> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      if (!uid) {
        throw new Error('User ID is required');
      }
      return getUserDetail(idToken, uid);
    },
    enabled: idToken !== null && uid !== null && uid !== '',
  });
}

export interface SuspendUserResult {
  id: string;
  isSuspended: boolean;
}

export function useSetUserSuspensionMutation(): UseMutationResult<
  SuspendUserResult,
  Error,
  { uid: string; isSuspended: boolean }
> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<
    SuspendUserResult,
    Error,
    { uid: string; isSuspended: boolean }
  >({
    mutationFn: ({ uid, isSuspended }) => {
      if (!idToken) {
        throw new Error('Authentication required');
      }

      return setUserSuspension(idToken, uid, isSuspended);
    },
    onSuccess: (result) => {
      toast.success(
        result.isSuspended
          ? 'User suspended'
          : 'User suspension revoked',
      );
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.users.all,
      });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update user suspension');
    },
  });
}
