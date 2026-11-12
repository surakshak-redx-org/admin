import { apiFetch } from '@/lib/api/client';
import type { Serialized } from '@/types/api.types';
import type { FAQ, Law, NewsItem, SafetyTip } from '@/types/firestore.types';

// ─── Laws Types ──────────────────────────────────────────────────────

export interface CreateLawPayload {
  title: string;
  shortDescription: string;
  fullContent: string;
  category: string;
  tags: string[];
  isPublished: boolean;
}

export type UpdateLawPayload = Partial<CreateLawPayload>;

// ─── FAQ Types ───────────────────────────────────────────────────────

export interface CreateFaqPayload {
  question: string;
  answer: string;
  category: string;
  isPublished: boolean;
}

export type UpdateFaqPayload = Partial<CreateFaqPayload>;

// ─── Safety Tips Types ───────────────────────────────────────────────

export interface CreateTipPayload {
  title: string;
  content: string;
  category: string;
  isPublished: boolean;
}

export type UpdateTipPayload = Partial<CreateTipPayload>;

// ─── News Types ──────────────────────────────────────────────────────

export type NewsItemWithId = Serialized<NewsItem> & { id: string };

export interface CreateNewsPayload {
  title: string;
  summary: string;
  content: string;
  imageUrl: string;
  category: string;
  isPublished: boolean;
  publishedAt?: string;
}

export type UpdateNewsPayload = Partial<CreateNewsPayload>;

// ─── Laws Service ────────────────────────────────────────────────────

/**
 * Fetches all laws ordered by display index.
 *
 * @param idToken Firebase ID token for authentication
 * @returns Array of laws
 */
export async function getLaws(idToken: string): Promise<Law[]> {
  return apiFetch<Law[]>('/api/content/laws', idToken);
}

/**
 * Creates a new legal information item.
 *
 * @param idToken Firebase ID token for authentication
 * @param payload Law content data
 * @returns Created law document ID
 */
export async function createLaw(
  idToken: string,
  payload: CreateLawPayload,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/api/content/laws', idToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Updates an existing legal information item.
 *
 * @param idToken Firebase ID token for authentication
 * @param id Law document ID
 * @param payload Fields to update
 * @returns Updated law document ID
 */
export async function updateLaw(
  idToken: string,
  id: string,
  payload: UpdateLawPayload,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/api/content/laws/${encodeURIComponent(id)}`, idToken, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * Deletes a legal information item.
 *
 * @param idToken Firebase ID token for authentication
 * @param id Law document ID
 * @returns Deleted law document ID
 */
export async function deleteLaw(idToken: string, id: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/api/content/laws/${encodeURIComponent(id)}`, idToken, {
    method: 'DELETE',
  });
}

/**
 * Toggles or explicitly sets publication state of a content item.
 *
 * @param idToken Firebase ID token for authentication
 * @param type Content type ('laws' | 'news' | 'tips' | 'faqs')
 * @param id Content document ID
 * @param isPublished Optional explicit publication boolean
 * @returns Toggled status and ID
 */
export async function togglePublishedContent(
  idToken: string,
  type: 'laws' | 'news' | 'tips' | 'faqs',
  id: string,
  isPublished?: boolean,
): Promise<{ id: string; isPublished: boolean }> {
  return apiFetch<{ id: string; isPublished: boolean }>(
    `/api/content/${type}/${encodeURIComponent(id)}`,
    idToken,
    {
      method: 'PATCH',
      ...(isPublished !== undefined ? { body: JSON.stringify({ isPublished }) } : {}),
    },
  );
}

/**
 * Toggles publication state of a law.
 *
 * @param idToken Firebase ID token for authentication
 * @param id Law document ID
 * @param isPublished Optional explicit publication boolean
 * @returns Toggled status and ID
 */
export async function toggleLaw(
  idToken: string,
  id: string,
  isPublished?: boolean,
): Promise<{ id: string; isPublished: boolean }> {
  return togglePublishedContent(idToken, 'laws', id, isPublished);
}

// ─── FAQs Service ────────────────────────────────────────────────────

/**
 * Fetches all FAQs ordered by display index.
 *
 * @param idToken Firebase ID token for authentication
 * @returns Array of FAQs
 */
export async function getFaqs(idToken: string): Promise<FAQ[]> {
  return apiFetch<FAQ[]>('/api/content/faqs', idToken);
}

/**
 * Creates a new FAQ.
 *
 * @param idToken Firebase ID token for authentication
 * @param payload FAQ content data
 * @returns Created FAQ document ID
 */
export async function createFaq(
  idToken: string,
  payload: CreateFaqPayload,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/api/content/faqs', idToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Updates an existing FAQ.
 *
 * @param idToken Firebase ID token for authentication
 * @param id FAQ document ID
 * @param payload Fields to update
 * @returns Updated FAQ document ID
 */
export async function updateFaq(
  idToken: string,
  id: string,
  payload: UpdateFaqPayload,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/api/content/faqs/${encodeURIComponent(id)}`, idToken, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * Deletes a FAQ.
 *
 * @param idToken Firebase ID token for authentication
 * @param id FAQ document ID
 * @returns Deleted FAQ document ID
 */
export async function deleteFaq(idToken: string, id: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/api/content/faqs/${encodeURIComponent(id)}`, idToken, {
    method: 'DELETE',
  });
}

/**
 * Toggles publication state of a FAQ.
 *
 * @param idToken Firebase ID token for authentication
 * @param id FAQ document ID
 * @returns Toggled status and ID
 */
export async function toggleFaq(
  idToken: string,
  id: string,
  isPublished?: boolean,
): Promise<{ id: string; isPublished: boolean }> {
  return togglePublishedContent(idToken, 'faqs', id, isPublished);
}

// ─── Safety Tips Service ─────────────────────────────────────────────

/**
 * Fetches all safety tips ordered by display index.
 *
 * @param idToken Firebase ID token for authentication
 * @returns Array of safety tips
 */
export async function getTips(idToken: string): Promise<SafetyTip[]> {
  return apiFetch<SafetyTip[]>('/api/content/tips', idToken);
}

export const getSafetyTips = getTips;

/**
 * Creates a new safety tip.
 *
 * @param idToken Firebase ID token for authentication
 * @param payload Safety tip content data
 * @returns Created tip document ID
 */
export async function createTip(
  idToken: string,
  payload: CreateTipPayload,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/api/content/tips', idToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export const createSafetyTip = createTip;

/**
 * Updates an existing safety tip.
 *
 * @param idToken Firebase ID token for authentication
 * @param id Safety tip document ID
 * @param payload Fields to update
 * @returns Updated tip document ID
 */
export async function updateTip(
  idToken: string,
  id: string,
  payload: UpdateTipPayload,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/api/content/tips/${encodeURIComponent(id)}`, idToken, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export const updateSafetyTip = updateTip;

/**
 * Deletes a safety tip.
 *
 * @param idToken Firebase ID token for authentication
 * @param id Safety tip document ID
 * @returns Deleted tip document ID
 */
export async function deleteTip(idToken: string, id: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/api/content/tips/${encodeURIComponent(id)}`, idToken, {
    method: 'DELETE',
  });
}

export const deleteSafetyTip = deleteTip;

/**
 * Toggles publication state of a safety tip.
 *
 * @param idToken Firebase ID token for authentication
 * @param id Safety tip document ID
 * @returns Toggled status and ID
 */
export async function toggleTip(
  idToken: string,
  id: string,
  isPublished?: boolean,
): Promise<{ id: string; isPublished: boolean }> {
  return togglePublishedContent(idToken, 'tips', id, isPublished);
}

export const toggleSafetyTip = toggleTip;

// ─── News Service ────────────────────────────────────────────────────

/**
 * Fetches published and draft news items ordered by publication timestamp.
 *
 * @param idToken Firebase ID token for authentication
 * @returns Array of serialized news items
 */
export async function getNews(idToken: string): Promise<NewsItemWithId[]> {
  return apiFetch<NewsItemWithId[]>('/api/content/news', idToken);
}

/**
 * Creates a new news article.
 *
 * @param idToken Firebase ID token for authentication
 * @param payload News item data
 * @returns Created news item document ID
 */
export async function createNews(
  idToken: string,
  payload: CreateNewsPayload,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>('/api/content/news', idToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Updates an existing news article.
 *
 * @param idToken Firebase ID token for authentication
 * @param id News item document ID
 * @param payload Fields to update
 * @returns Updated news document ID
 */
export async function updateNews(
  idToken: string,
  id: string,
  payload: UpdateNewsPayload,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/api/content/news/${encodeURIComponent(id)}`, idToken, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * Deletes a news article.
 *
 * @param idToken Firebase ID token for authentication
 * @param id News item document ID
 * @returns Deleted news document ID
 */
export async function deleteNews(idToken: string, id: string): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/api/content/news/${encodeURIComponent(id)}`, idToken, {
    method: 'DELETE',
  });
}

/**
 * Toggles publication state of a news article.
 *
 * @param idToken Firebase ID token for authentication
 * @param id News item document ID
 * @param isPublished Optional explicit publication boolean
 * @returns Toggled status and ID
 */
export async function toggleNews(
  idToken: string,
  id: string,
  isPublished?: boolean,
): Promise<{ id: string; isPublished: boolean }> {
  return togglePublishedContent(idToken, 'news', id, isPublished);
}
