import type { IncidentStatus, UnsafeAreaStatus } from '@/types/firestore.types';

/**
 * Central registry of React Query cache keys.
 * Ensures consistent key structures across queries, mutations, and cache invalidation.
 */
export const QUERY_KEYS = {
  stats: ['stats'] as const,
  users: {
    all: ['users'] as const,
    lists: (): readonly ['users', 'list'] => ['users', 'list'] as const,
    list: (
      search?: string,
      cursor?: string | null,
      limit?: number,
    ): readonly [
      'users',
      'list',
      { readonly search: string; readonly cursor: string | null; readonly limit: number | null },
    ] =>
      [
        'users',
        'list',
        { search: search ?? '', cursor: cursor ?? null, limit: limit ?? null },
      ] as const,
    recent: ['users', 'recent'] as const,
    details: (): readonly ['users', 'detail'] => ['users', 'detail'] as const,
    detail: (uid: string): readonly ['users', 'detail', string] =>
      ['users', 'detail', uid] as const,
  },
  incidents: {
    all: ['incidents'] as const,
    lists: (): readonly ['incidents', 'list'] => ['incidents', 'list'] as const,
    list: (
      status?: IncidentStatus | 'all',
      cursor?: string | null,
    ): readonly [
      'incidents',
      'list',
      { readonly status: IncidentStatus | 'all'; readonly cursor: string | null },
    ] => ['incidents', 'list', { status: status ?? 'all', cursor: cursor ?? null }] as const,
    recent: ['incidents', 'recent'] as const,
    details: (): readonly ['incidents', 'detail'] => ['incidents', 'detail'] as const,
    detail: (id: string): readonly ['incidents', 'detail', string] =>
      ['incidents', 'detail', id] as const,
  },
  moderation: {
    all: ['moderation'] as const,
    lists: (): readonly ['moderation', 'list'] => ['moderation', 'list'] as const,
    list: (
      cursor?: string | null,
    ): readonly ['moderation', 'list', { readonly cursor: string | null }] =>
      ['moderation', 'list', { cursor: cursor ?? null }] as const,
    details: (): readonly ['moderation', 'detail'] => ['moderation', 'detail'] as const,
    detail: (id: string): readonly ['moderation', 'detail', string] =>
      ['moderation', 'detail', id] as const,
  },
  unsafeAreas: {
    all: ['unsafe-areas'] as const,
    lists: (): readonly ['unsafe-areas', 'list'] => ['unsafe-areas', 'list'] as const,
    list: (
      status?: UnsafeAreaStatus | 'all',
      cursor?: string | null,
    ): readonly [
      'unsafe-areas',
      'list',
      { readonly status: UnsafeAreaStatus | 'all'; readonly cursor: string | null },
    ] => ['unsafe-areas', 'list', { status: status ?? 'all', cursor: cursor ?? null }] as const,
    details: (): readonly ['unsafe-areas', 'detail'] => ['unsafe-areas', 'detail'] as const,
    detail: (id: string): readonly ['unsafe-areas', 'detail', string] =>
      ['unsafe-areas', 'detail', id] as const,
  },
  admins: {
    all: ['admins'] as const,
    lists: (): readonly ['admins', 'list'] => ['admins', 'list'] as const,
    list: (limit?: number): readonly ['admins', 'list', { readonly limit: number | null }] =>
      ['admins', 'list', { limit: limit ?? null }] as const,
  },
  content: {
    all: ['content'] as const,
    laws: ['content', 'laws'] as const,
    faqs: ['content', 'faqs'] as const,
    tips: ['content', 'tips'] as const,
    news: ['content', 'news'] as const,
  },
  communityPosts: {
    all: ['community-posts'] as const,
    list: (sort: string, status: string): readonly ['community-posts', string, string] =>
      ['community-posts', sort, status] as const,
  },
} as const;
