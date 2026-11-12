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
import {
  createFaq,
  createLaw,
  createNews,
  createTip,
  deleteFaq,
  deleteLaw,
  deleteNews,
  deleteTip,
  getFaqs,
  getLaws,
  getNews,
  getTips,
  toggleFaq,
  toggleLaw,
  toggleNews,
  togglePublishedContent,
  toggleTip,
  updateFaq,
  updateLaw,
  updateNews,
  updateTip,
  type CreateFaqPayload,
  type CreateLawPayload,
  type CreateNewsPayload,
  type CreateTipPayload,
  type NewsItemWithId,
  type UpdateFaqPayload,
  type UpdateLawPayload,
  type UpdateNewsPayload,
  type UpdateTipPayload,
} from '@/services/content.service';
import type { FAQ, Law, SafetyTip } from '@/types/firestore.types';

export type ContentIdVariables = string | { id: string };

function resolveId(variables: ContentIdVariables): string {
  return typeof variables === 'string' ? variables : variables.id;
}

// ─── Laws Hooks ──────────────────────────────────────────────────────

export type SaveLawVariables =
  (CreateLawPayload & { id?: string }) | (UpdateLawPayload & { id: string });

/**
 * Custom hook to query all legal information entries.
 *
 * @returns React Query result with array of laws
 */
export function useLawsQuery(): UseQueryResult<Law[], Error> {
  const { idToken } = useAuth();

  return useQuery<Law[], Error>({
    queryKey: QUERY_KEYS.content.laws,
    queryFn: (): Promise<Law[]> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return getLaws(idToken);
    },
    enabled: idToken !== null,
  });
}

/**
 * Custom mutation hook to save (create or update) a legal information entry.
 *
 * @returns React Query mutation result
 */
export function useSaveLawMutation(): UseMutationResult<{ id: string }, Error, SaveLawVariables> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ id: string }, Error, SaveLawVariables>({
    mutationFn: (variables: SaveLawVariables): Promise<{ id: string }> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      if (variables.id) {
        const { id, ...payload } = variables;
        return updateLaw(idToken, id, payload);
      }
      return createLaw(idToken, variables as CreateLawPayload);
    },
    onSuccess: (): void => {
      toast.success('Law saved');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.content.laws });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
    onError: (error: Error): void => {
      toast.error(error.message || 'Failed to save law');
    },
  });
}

/**
 * Custom mutation hook to toggle publication state of a law.
 *
 * @returns React Query mutation result
 */
export function useToggleLawMutation(): UseMutationResult<
  { id: string; isPublished: boolean },
  Error,
  ContentIdVariables
> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ id: string; isPublished: boolean }, Error, ContentIdVariables>({
    mutationFn: (variables: ContentIdVariables): Promise<{ id: string; isPublished: boolean }> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return toggleLaw(idToken, resolveId(variables));
    },
    onSuccess: (data: { id: string; isPublished: boolean }): void => {
      toast.success(data.isPublished ? 'Law published' : 'Law unpublished');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.content.laws });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
    onError: (error: Error): void => {
      toast.error(error.message || 'Failed to update law');
    },
  });
}

/**
 * Custom mutation hook to delete a law.
 *
 * @returns React Query mutation result
 */
export function useDeleteLawMutation(): UseMutationResult<
  { id: string },
  Error,
  ContentIdVariables
> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ id: string }, Error, ContentIdVariables>({
    mutationFn: (variables: ContentIdVariables): Promise<{ id: string }> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return deleteLaw(idToken, resolveId(variables));
    },
    onSuccess: (): void => {
      toast.success('Law deleted');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.content.laws });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
    onError: (error: Error): void => {
      toast.error(error.message || 'Failed to delete law');
    },
  });
}

// ─── FAQs Hooks ──────────────────────────────────────────────────────

export type SaveFaqVariables =
  (CreateFaqPayload & { id?: string }) | (UpdateFaqPayload & { id: string });

/**
 * Custom hook to query all FAQ entries.
 *
 * @returns React Query result with array of FAQs
 */
export function useFaqsQuery(): UseQueryResult<FAQ[], Error> {
  const { idToken } = useAuth();

  return useQuery<FAQ[], Error>({
    queryKey: QUERY_KEYS.content.faqs,
    queryFn: (): Promise<FAQ[]> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return getFaqs(idToken);
    },
    enabled: idToken !== null,
  });
}

/**
 * Custom mutation hook to save (create or update) a FAQ entry.
 *
 * @returns React Query mutation result
 */
export function useSaveFaqMutation(): UseMutationResult<{ id: string }, Error, SaveFaqVariables> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ id: string }, Error, SaveFaqVariables>({
    mutationFn: (variables: SaveFaqVariables): Promise<{ id: string }> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      if (variables.id) {
        const { id, ...payload } = variables;
        return updateFaq(idToken, id, payload);
      }
      return createFaq(idToken, variables as CreateFaqPayload);
    },
    onSuccess: (): void => {
      toast.success('FAQ saved');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.content.faqs });
    },
    onError: (error: Error): void => {
      toast.error(error.message || 'Failed to save FAQ');
    },
  });
}

/**
 * Custom mutation hook to toggle publication state of a FAQ.
 *
 * @returns React Query mutation result
 */
export function useToggleFaqMutation(): UseMutationResult<
  { id: string; isPublished: boolean },
  Error,
  ContentIdVariables
> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ id: string; isPublished: boolean }, Error, ContentIdVariables>({
    mutationFn: (variables: ContentIdVariables): Promise<{ id: string; isPublished: boolean }> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return toggleFaq(idToken, resolveId(variables));
    },
    onSuccess: (data: { id: string; isPublished: boolean }): void => {
      toast.success(data.isPublished ? 'FAQ published' : 'FAQ unpublished');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.content.faqs });
    },
    onError: (error: Error): void => {
      toast.error(error.message || 'Failed to update FAQ');
    },
  });
}

/**
 * Custom mutation hook to delete a FAQ.
 *
 * @returns React Query mutation result
 */
export function useDeleteFaqMutation(): UseMutationResult<
  { id: string },
  Error,
  ContentIdVariables
> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ id: string }, Error, ContentIdVariables>({
    mutationFn: (variables: ContentIdVariables): Promise<{ id: string }> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return deleteFaq(idToken, resolveId(variables));
    },
    onSuccess: (): void => {
      toast.success('FAQ deleted');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.content.faqs });
    },
    onError: (error: Error): void => {
      toast.error(error.message || 'Failed to delete FAQ');
    },
  });
}

// ─── Safety Tips Hooks ───────────────────────────────────────────────

export type SaveTipVariables =
  (CreateTipPayload & { id?: string }) | (UpdateTipPayload & { id: string });

/**
 * Custom hook to query all safety tips.
 *
 * @returns React Query result with array of safety tips
 */
export function useTipsQuery(): UseQueryResult<SafetyTip[], Error> {
  const { idToken } = useAuth();

  return useQuery<SafetyTip[], Error>({
    queryKey: QUERY_KEYS.content.tips,
    queryFn: (): Promise<SafetyTip[]> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return getTips(idToken);
    },
    enabled: idToken !== null,
  });
}

/**
 * Custom mutation hook to save (create or update) a safety tip.
 *
 * @returns React Query mutation result
 */
export function useSaveTipMutation(): UseMutationResult<{ id: string }, Error, SaveTipVariables> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ id: string }, Error, SaveTipVariables>({
    mutationFn: (variables: SaveTipVariables): Promise<{ id: string }> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      if (variables.id) {
        const { id, ...payload } = variables;
        return updateTip(idToken, id, payload);
      }
      return createTip(idToken, variables as CreateTipPayload);
    },
    onSuccess: (): void => {
      toast.success('Safety tip saved');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.content.tips });
    },
    onError: (error: Error): void => {
      toast.error(error.message || 'Failed to save safety tip');
    },
  });
}

/**
 * Custom mutation hook to toggle publication state of a safety tip.
 *
 * @returns React Query mutation result
 */
export function useToggleTipMutation(): UseMutationResult<
  { id: string; isPublished: boolean },
  Error,
  ContentIdVariables
> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ id: string; isPublished: boolean }, Error, ContentIdVariables>({
    mutationFn: (variables: ContentIdVariables): Promise<{ id: string; isPublished: boolean }> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return toggleTip(idToken, resolveId(variables));
    },
    onSuccess: (data: { id: string; isPublished: boolean }): void => {
      toast.success(data.isPublished ? 'Safety tip published' : 'Safety tip unpublished');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.content.tips });
    },
    onError: (error: Error): void => {
      toast.error(error.message || 'Failed to update safety tip');
    },
  });
}

/**
 * Custom mutation hook to delete a safety tip.
 *
 * @returns React Query mutation result
 */
export function useDeleteTipMutation(): UseMutationResult<
  { id: string },
  Error,
  ContentIdVariables
> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ id: string }, Error, ContentIdVariables>({
    mutationFn: (variables: ContentIdVariables): Promise<{ id: string }> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return deleteTip(idToken, resolveId(variables));
    },
    onSuccess: (): void => {
      toast.success('Safety tip deleted');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.content.tips });
    },
    onError: (error: Error): void => {
      toast.error(error.message || 'Failed to delete safety tip');
    },
  });
}

// ─── News Hooks ──────────────────────────────────────────────────────

export type SaveNewsVariables =
  (CreateNewsPayload & { id?: string }) | (UpdateNewsPayload & { id: string });

/**
 * Custom hook to query all news articles.
 *
 * @returns React Query result with array of news items
 */
export function useNewsQuery(): UseQueryResult<NewsItemWithId[], Error> {
  const { idToken } = useAuth();

  return useQuery<NewsItemWithId[], Error>({
    queryKey: QUERY_KEYS.content.news,
    queryFn: (): Promise<NewsItemWithId[]> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return getNews(idToken);
    },
    enabled: idToken !== null,
  });
}

/**
 * Custom mutation hook to save (create or update) a news article.
 *
 * @returns React Query mutation result
 */
export function useSaveNewsMutation(): UseMutationResult<{ id: string }, Error, SaveNewsVariables> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ id: string }, Error, SaveNewsVariables>({
    mutationFn: (variables: SaveNewsVariables): Promise<{ id: string }> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      if (variables.id) {
        const { id, ...payload } = variables;
        return updateNews(idToken, id, payload);
      }
      return createNews(idToken, variables as CreateNewsPayload);
    },
    onSuccess: (): void => {
      toast.success('News item saved');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.content.news });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
    onError: (error: Error): void => {
      toast.error(error.message || 'Failed to save news item');
    },
  });
}

/**
 * Custom mutation hook to toggle publication state of a news article.
 *
 * @returns React Query mutation result
 */
export function useToggleNewsMutation(): UseMutationResult<
  { id: string; isPublished: boolean },
  Error,
  ContentIdVariables
> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ id: string; isPublished: boolean }, Error, ContentIdVariables>({
    mutationFn: (variables: ContentIdVariables): Promise<{ id: string; isPublished: boolean }> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return toggleNews(idToken, resolveId(variables));
    },
    onSuccess: (data: { id: string; isPublished: boolean }): void => {
      toast.success(data.isPublished ? 'News item published' : 'News item unpublished');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.content.news });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
    onError: (error: Error): void => {
      toast.error(error.message || 'Failed to update news item');
    },
  });
}

/**
 * Custom mutation hook to delete a news article.
 *
 * @returns React Query mutation result
 */
export function useDeleteNewsMutation(): UseMutationResult<
  { id: string },
  Error,
  ContentIdVariables
> {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ id: string }, Error, ContentIdVariables>({
    mutationFn: (variables: ContentIdVariables): Promise<{ id: string }> => {
      if (!idToken) {
        throw new Error('Authentication required');
      }
      return deleteNews(idToken, resolveId(variables));
    },
    onSuccess: (): void => {
      toast.success('News item deleted');
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.content.news });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stats });
    },
    onError: (error: Error): void => {
      toast.error(error.message || 'Failed to delete news item');
    },
  });
}

export interface Publishable {
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
 * Flips at once, rolls back with an error toast on failure, confirms with a toast on
 * success, and only disables the row being changed.
 */
export function useTogglePublished<T extends Publishable>(
  type: 'laws' | 'news' | 'tips' | 'faqs',
  noun: string,
): TogglePublished {
  const { idToken } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = QUERY_KEYS.content[type];

  const setPublished = (id: string, isPublished: boolean): void => {
    queryClient.setQueryData<T[]>(
      queryKey,
      (current) => current?.map((item) => (item.id === id ? { ...item, isPublished } : item)) ?? [],
    );
  };

  const mutation = useMutation({
    mutationFn: ({
      id,
      isPublished,
    }: ToggleVariables): Promise<{ id: string; isPublished: boolean }> =>
      togglePublishedContent(idToken ?? '', type, id, isPublished),
    onMutate: async ({ id, isPublished }: ToggleVariables): Promise<void> => {
      await queryClient.cancelQueries({ queryKey });
      setPublished(id, isPublished);
    },
    onError: (_error: unknown, { id, isPublished }: ToggleVariables): void => {
      setPublished(id, !isPublished);
      toast.error(`Failed to update ${noun}`);
    },
    onSuccess: ({ id, isPublished }: ToggleVariables): void => {
      setPublished(id, isPublished);
      toast.success(isPublished ? `${noun} published` : `${noun} unpublished`);
    },
  });

  return {
    toggle: (id: string, isPublished: boolean): void => mutation.mutate({ id, isPublished }),
    pendingId: mutation.isPending ? (mutation.variables?.id ?? null) : null,
  };
}
