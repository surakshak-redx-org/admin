'use client';

import {
  useMutation,
  type UseMutationResult,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { QUERY_KEYS } from '@/hooks/query-keys';
import { useAuth } from '@/lib/auth/session';
import { addAdmin, type AdminUserWithId, getAdmins, removeAdmin } from '@/services/admins.service';

export type AddAdminVariables = string | { email: string };
export type RemoveAdminVariables = string | { uid: string };

export interface RemoveAdminResult {
  uid: string;
  removed: boolean;
}

/**
 * Custom hook to query all registered dashboard administrators.
 * Enabled only when user is authenticated AND possesses the `super_admin` role.
 *
 * @returns React Query result with array of admin users
 */
export function useAdminsQuery(): UseQueryResult<AdminUserWithId[], Error> {
  const { user, idToken } = useAuth();

  return useQuery<AdminUserWithId[], Error>({
    queryKey: QUERY_KEYS.admins.all,
    queryFn: (): Promise<AdminUserWithId[]> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return getAdmins(idToken);
    },
    enabled: idToken !== null && user?.role === 'super_admin',
  });
}

/**
 * Custom mutation hook to promote an existing user account to administrator by email.
 * Automatically invalidates admin list queries and displays toast notifications.
 *
 * @returns React Query mutation result
 */
export function useAddAdminMutation(): UseMutationResult<
  AdminUserWithId,
  Error,
  AddAdminVariables
> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<AdminUserWithId, Error, AddAdminVariables>({
    mutationFn: (variables: AddAdminVariables): Promise<AdminUserWithId> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      const email = typeof variables === 'string' ? variables : variables.email;
      return addAdmin(idToken, email);
    },
    onSuccess: (): void => {
      toast.success('Admin added');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admins.all });
    },
    onError: (error: Error): void => {
      toast.error(error.message || 'No Surakshak account with this email');
    },
  });
}

/**
 * Custom mutation hook to remove an administrator's dashboard privileges.
 * Automatically invalidates admin list queries and displays toast notifications.
 *
 * @returns React Query mutation result
 */
export function useRemoveAdminMutation(): UseMutationResult<
  RemoveAdminResult,
  Error,
  RemoveAdminVariables
> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<RemoveAdminResult, Error, RemoveAdminVariables>({
    mutationFn: (variables: RemoveAdminVariables): Promise<RemoveAdminResult> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      const uid = typeof variables === 'string' ? variables : variables.uid;
      return removeAdmin(idToken, uid);
    },
    onSuccess: (): void => {
      toast.success('Admin removed');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admins.all });
    },
    onError: (error: Error): void => {
      toast.error(error.message || 'Failed to remove admin');
    },
  });
}
