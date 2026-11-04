import { z } from 'zod';

import { SHORT_DESCRIPTION_MAX_LENGTH } from '@/constants/config';

/**
 * Input validation for the News and Laws forms. Shared by the forms (instant
 * feedback) and the API routes (the real enforcement: a client can always be
 * bypassed). Content saved here is read by the Surakshak app, so markup and
 * script-capable URLs are rejected at the door rather than trusting every
 * consumer to escape them.
 */

export const MARKUP_NOT_ALLOWED_ERROR = 'HTML tags are not allowed. Remove any < > markup.';
export const IMAGE_URL_ERROR = 'Image URL must be a valid https:// link';
export const PUBLISHED_AT_ERROR = 'Published date is not valid';
export const INVALID_BODY_ERROR = 'Invalid request body';

export const REQUIRED_TITLE_ERROR = 'Title is required';
export const REQUIRED_CATEGORY_ERROR = 'Category is required';
export const REQUIRED_SHORT_DESCRIPTION_ERROR = 'Short description is required';

const HTTPS_PROTOCOL = 'https:';

/** Start of an HTML tag, closing tag, comment, doctype or processing instruction. */
const MARKUP_PATTERN = /<[a-zA-Z/!?]/;

export function containsMarkup(value: string): boolean {
  return MARKUP_PATTERN.test(value);
}

function hasNoMarkup(value: string): boolean {
  return !containsMarkup(value);
}

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === HTTPS_PROTOCOL;
  } catch {
    return false;
  }
}

/** Free-text field: required, optionally length-capped, and free of HTML markup. */
export function plainTextField(
  requiredMessage: string,
  maxLength?: number,
): z.ZodEffects<z.ZodString, string, string> {
  const required = z.string().min(1, requiredMessage);
  const bounded = maxLength === undefined ? required : required.max(maxLength);
  return bounded.refine(hasNoMarkup, MARKUP_NOT_ALLOWED_ERROR);
}

/** Free-text field that may be empty but must not contain HTML markup. */
export const optionalPlainText = z.string().refine(hasNoMarkup, MARKUP_NOT_ALLOWED_ERROR);

/** Empty (no image) or an absolute https URL: never `javascript:`, `data:` or `http:`. */
export const imageUrlField = z
  .string()
  .refine((value: string): boolean => value === '' || isHttpsUrl(value), IMAGE_URL_ERROR);

/** Empty (the server uses "now") or a string `Date` can parse. */
export const publishedAtField = z
  .string()
  .refine(
    (value: string): boolean => value === '' || !Number.isNaN(Date.parse(value)),
    PUBLISHED_AT_ERROR,
  );

export const lawBodySchema = z
  .object({
    title: plainTextField(REQUIRED_TITLE_ERROR),
    shortDescription: plainTextField(
      REQUIRED_SHORT_DESCRIPTION_ERROR,
      SHORT_DESCRIPTION_MAX_LENGTH,
    ),
    fullContent: plainTextField('Full content is required'),
    category: plainTextField(REQUIRED_CATEGORY_ERROR),
    tags: z.array(plainTextField('Tags cannot be empty')),
    isPublished: z.boolean(),
  })
  .strict();

export const lawUpdateSchema = lawBodySchema.partial();

export const newsBodySchema = z
  .object({
    title: plainTextField(REQUIRED_TITLE_ERROR),
    summary: plainTextField('Summary is required'),
    content: plainTextField('Content is required'),
    imageUrl: imageUrlField,
    category: plainTextField(REQUIRED_CATEGORY_ERROR),
    isPublished: z.boolean(),
    publishedAt: publishedAtField.optional(),
  })
  .strict();

export const newsUpdateSchema = newsBodySchema.partial();

/** First human-readable validation message, for a 400 response. */
export function validationMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? INVALID_BODY_ERROR;
}
