/** Page size for the paginated /api/users list (cursor-based "Load more"). */
export const USERS_PAGE_SIZE = 50;
export const COMMUNITY_POSTS_PAGE_SIZE = 50;

/** Search input debounce on the Users page, in milliseconds. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Report count at which a moderation row's badge turns red. Mirrors
 * `REPORT_THRESHOLD` in functions/src/moderation/onPostReported.ts — that is
 * the count at which the app auto-hides a post in the first place, so every
 * row in the moderation queue is already at or past this number.
 */
export const REPORT_COUNT_DANGER_THRESHOLD = 3;

/** Max characters shown before truncating a title in table rows. */
export const TITLE_TRUNCATE_LENGTH = 60;

/** Max characters shown for a moderation queue content preview. */
export const CONTENT_PREVIEW_LENGTH = 100;

/** Max length enforced on the Law "short description" form field. */
export const SHORT_DESCRIPTION_MAX_LENGTH = 200;

/** Default React Query staleTime: how long fetched data is considered fresh. */
export const QUERY_STALE_TIME_MS = 1000 * 60 * 5;

/** React Query staleTime override for queries that must always refetch on mount. */
export const QUERY_ALWAYS_STALE_TIME_MS = 0;

/** Default React Query gcTime: how long unused cached data is kept before eviction. */
export const QUERY_GC_TIME_MS = 1000 * 60 * 15;

/** Default React Query retry count for failed queries. */
export const QUERY_RETRY_COUNT = 1;
