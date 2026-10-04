'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { apiFetch } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/session';

interface Publishable {
  id: string;
  isPublished: boolean;
}

interface ToggleVariables {
  id: string;
  isPublished: boolean;
}

export interface TogglePublished {
  /** Sets one row's published state; the switch flips immediately. */
  toggle: (id: string, isPublished: boolean) => void;
  /** The row whose request is in flight, so only that switch is disabled. */
  pendingId: string | null;
}

/**
 * Optimistic publish/unpublish shared by the four content tabs.
 *
 * The switch used to wait for the round trip (token check, admin lookup,
 * read, write) before moving, greyed out every row meanwhile, and said
 * nothing on success — so Publish felt broken (BUG-010). It now flips at
 * once, rolls back with an error toast on failure, confirms with a toast on
 * success, and only disables the row being changed.
 */
export function useTogglePublished<T extends Publishable>(
  type: 'laws' | 'news' | 'tips' | 'faqs',
  noun: string,
): TogglePublished {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['content', type];

  const setPublished = (id: string, isPublished: boolean): void => {
    queryClient.setQueryData<T[]>(
      queryKey,
      (current) => current?.map((item) => (item.id === id ? { ...item, isPublished } : item)) ?? [],
    );
  };

  const mutation = useMutation({
    mutationFn: ({ id, isPublished }: ToggleVariables) =>
      apiFetch<ToggleVariables>(`/api/content/${type}/${id}`, idToken ?? '', {
        method: 'PATCH',
        body: JSON.stringify({ isPublished }),
      }),
    onMutate: async ({ id, isPublished }: ToggleVariables) => {
      await queryClient.cancelQueries({ queryKey });
      setPublished(id, isPublished);
    },
    onError: (_error, { id, isPublished }) => {
      setPublished(id, !isPublished);
      toast.error(`Failed to update ${noun}`);
    },
    onSuccess: ({ id, isPublished }) => {
      setPublished(id, isPublished);
      toast.success(isPublished ? `${noun} published` : `${noun} unpublished`);
    },
  });

  return {
    toggle: (id, isPublished): void => mutation.mutate({ id, isPublished }),
    pendingId: mutation.isPending ? (mutation.variables?.id ?? null) : null,
  };
}
