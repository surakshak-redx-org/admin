/** Page size for the paginated /api/users list (cursor-based "Load more"). */
export const USERS_PAGE_SIZE = 50;

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
