import { describe, expect, it } from 'vitest';
import type { ZodTypeAny } from 'zod';

import { SHORT_DESCRIPTION_MAX_LENGTH } from '@/constants/config';
import {
  containsMarkup,
  IMAGE_URL_ERROR,
  isHttpsUrl,
  lawBodySchema,
  lawUpdateSchema,
  MARKUP_NOT_ALLOWED_ERROR,
  newsBodySchema,
  newsUpdateSchema,
  PUBLISHED_AT_ERROR,
  validationMessage,
} from '@/lib/content/content-validation';

const SCRIPT_TAG = '<script>alert(1)</script>';
const IMG_ONERROR = '<img src=x onerror=alert(1)>';

const MARKUP_SAMPLES: readonly string[] = [
  SCRIPT_TAG,
  IMG_ONERROR,
  '</div>',
  '<!-- hidden -->',
  '<svg/onload=alert(1)>',
  'hello <b>world</b>',
];

const SAFE_SAMPLES: readonly string[] = [
  'Plain text',
  'Section 5 < 10 days',
  'I <3 safety',
  'Tom & Jerry',
  'a > b',
];

const NON_HTTPS_URLS: readonly string[] = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  'http://example.com/a.png',
  'data:image/svg+xml,<svg onload=alert(1)>',
  '//example.com/a.png',
  'not a url',
  '',
];

const BAD_IMAGE_URLS: readonly string[] = [
  'javascript:alert(1)',
  'http://example.com/a.png',
  'data:text/html,<b>x</b>',
];

const validLaw = {
  title: 'Domestic Violence Act',
  shortDescription: 'Protection from abuse at home',
  fullContent: 'Section 5 < 10 days notice applies.',
  category: 'Family',
  tags: ['safety', 'home'],
  isPublished: true,
};

const validNews = {
  title: 'New helpline launched',
  summary: 'A 24x7 helpline is live',
  content: 'Details of the helpline',
  imageUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/pic.png',
  category: 'Updates',
  isPublished: false,
  publishedAt: '2026-10-01T10:00:00.000Z',
};

function messageFor(schema: ZodTypeAny, input: unknown): string | null {
  const result = schema.safeParse(input);
  return result.success ? null : validationMessage(result.error);
}

describe('containsMarkup', (): void => {
  it.each(MARKUP_SAMPLES)('flags %s', (value: string): void => {
    expect(containsMarkup(value)).toBe(true);
  });

  it.each(SAFE_SAMPLES)('allows %s', (value: string): void => {
    expect(containsMarkup(value)).toBe(false);
  });
});

describe('isHttpsUrl', (): void => {
  it('accepts an https URL', (): void => {
    expect(isHttpsUrl('https://example.com/a.png')).toBe(true);
  });

  it.each(NON_HTTPS_URLS)('rejects %s', (value: string): void => {
    expect(isHttpsUrl(value)).toBe(false);
  });
});

describe('lawBodySchema', (): void => {
  it('accepts a valid law', (): void => {
    expect(lawBodySchema.safeParse(validLaw).success).toBe(true);
  });

  it('rejects markup in the title', (): void => {
    const message = messageFor(lawBodySchema, { ...validLaw, title: SCRIPT_TAG });
    expect(message).toBe(MARKUP_NOT_ALLOWED_ERROR);
  });

  it('rejects markup in the full content', (): void => {
    const message = messageFor(lawBodySchema, { ...validLaw, fullContent: IMG_ONERROR });
    expect(message).toBe(MARKUP_NOT_ALLOWED_ERROR);
  });

  it('rejects markup in a tag', (): void => {
    const message = messageFor(lawBodySchema, { ...validLaw, tags: ['ok', SCRIPT_TAG] });
    expect(message).toBe(MARKUP_NOT_ALLOWED_ERROR);
  });

  it('rejects a short description over the limit', (): void => {
    const shortDescription = 'a'.repeat(SHORT_DESCRIPTION_MAX_LENGTH + 1);
    const result = lawBodySchema.safeParse({ ...validLaw, shortDescription });
    expect(result.success).toBe(false);
  });

  it('rejects fields the form does not send', (): void => {
    expect(lawBodySchema.safeParse({ ...validLaw, order: 0 }).success).toBe(false);
    expect(lawBodySchema.safeParse({ ...validLaw, id: 'other' }).success).toBe(false);
  });
});

describe('lawUpdateSchema', (): void => {
  it('accepts a partial update', (): void => {
    expect(lawUpdateSchema.safeParse({ isPublished: true }).success).toBe(true);
  });

  it('still rejects markup and unknown fields', (): void => {
    const message = messageFor(lawUpdateSchema, { title: IMG_ONERROR });
    expect(message).toBe(MARKUP_NOT_ALLOWED_ERROR);
    expect(lawUpdateSchema.safeParse({ order: 5 }).success).toBe(false);
  });
});

describe('newsBodySchema', (): void => {
  it('accepts a valid news item', (): void => {
    expect(newsBodySchema.safeParse(validNews).success).toBe(true);
  });

  it('accepts an empty image URL and an empty publish date', (): void => {
    const result = newsBodySchema.safeParse({ ...validNews, imageUrl: '', publishedAt: '' });
    expect(result.success).toBe(true);
  });

  it('rejects markup in the summary and content', (): void => {
    const summary = messageFor(newsBodySchema, { ...validNews, summary: SCRIPT_TAG });
    const content = messageFor(newsBodySchema, { ...validNews, content: IMG_ONERROR });
    expect(summary).toBe(MARKUP_NOT_ALLOWED_ERROR);
    expect(content).toBe(MARKUP_NOT_ALLOWED_ERROR);
  });

  it.each(BAD_IMAGE_URLS)('rejects image URL %s', (imageUrl: string): void => {
    expect(messageFor(newsBodySchema, { ...validNews, imageUrl })).toBe(IMAGE_URL_ERROR);
  });

  it('rejects an unparseable publish date', (): void => {
    const message = messageFor(newsBodySchema, { ...validNews, publishedAt: 'not-a-date' });
    expect(message).toBe(PUBLISHED_AT_ERROR);
  });

  it('rejects fields the form does not send', (): void => {
    expect(newsBodySchema.safeParse({ ...validNews, isFeatured: true }).success).toBe(false);
  });
});

describe('newsUpdateSchema', (): void => {
  it('accepts a partial update and rejects a script image URL', (): void => {
    expect(newsUpdateSchema.safeParse({ title: 'Edited' }).success).toBe(true);
    const message = messageFor(newsUpdateSchema, { imageUrl: 'javascript:alert(1)' });
    expect(message).toBe(IMAGE_URL_ERROR);
  });
});
