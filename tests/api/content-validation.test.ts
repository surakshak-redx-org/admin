import type { DecodedIdToken } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { PUT as updateLaw } from '@/app/api/content/laws/[id]/route';
import { POST as createLaw } from '@/app/api/content/laws/route';
import { PUT as updateNews } from '@/app/api/content/news/[id]/route';
import { POST as createNews } from '@/app/api/content/news/route';
import { COLLECTIONS } from '@/constants/firestore';
import { IMAGE_URL_ERROR, MARKUP_NOT_ALLOWED_ERROR } from '@/lib/content/content-validation';

import {
  mockAdminAuth,
  mockAdminDb,
  resetFirestoreMocks,
  setCollectionDocs,
} from '../mocks/firebase-admin.mock';

interface ApiResponse<T> {
  readonly data: T | null;
  readonly error: string | null;
}

const ADMIN_UID = 'admin-uid';
const LAW_ID = 'law-1';
const NEWS_ID = 'news-1';
const SCRIPT_TAG = '<script>alert(document.cookie)</script>';
const IMG_ONERROR = '<img src=x onerror=alert(1)>';
const ORIGINAL_PUBLISHED_AT = Timestamp.fromDate(new Date('2026-01-01T00:00:00.000Z'));

const validLaw = {
  title: 'Domestic Violence Act',
  shortDescription: 'Protection from abuse at home',
  fullContent: 'Full text of the law.',
  category: 'Family',
  tags: ['safety'],
  isPublished: true,
};

const validNews = {
  title: 'New helpline launched',
  summary: 'A 24x7 helpline is live',
  content: 'Details of the helpline',
  imageUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/pic.png',
  category: 'Updates',
  isPublished: false,
};

function jsonRequest(url: string, method: string, body: unknown, withAuth = true): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      ...(withAuth ? { Authorization: 'Bearer token' } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function storedDocs(collection: string): Promise<Record<string, unknown>[]> {
  const snap = await mockAdminDb.collection(collection).get();
  return snap.docs.map((doc): Record<string, unknown> => doc.data() ?? {});
}

async function errorOf(response: Response): Promise<string | null> {
  const json = (await response.json()) as ApiResponse<unknown>;
  return json.error;
}

describe('News and Laws input validation', (): void => {
  beforeEach((): void => {
    resetFirestoreMocks();
    mockAdminAuth.verifyIdToken.mockResolvedValue({
      uid: ADMIN_UID,
      email: 'admin@surakshak.in',
    } as unknown as DecodedIdToken);
    setCollectionDocs('admins', [{ id: ADMIN_UID, data: { uid: ADMIN_UID, role: 'admin' } }]);
    setCollectionDocs(COLLECTIONS.LAWS, []);
    setCollectionDocs(COLLECTIONS.NEWS, []);
  });

  describe('POST /api/content/laws', (): void => {
    const url = 'http://localhost:3000/api/content/laws';

    it('creates a law from a valid body', async (): Promise<void> => {
      const response = await createLaw(jsonRequest(url, 'POST', validLaw));

      expect(response.status).toBe(201);
      expect(await storedDocs(COLLECTIONS.LAWS)).toHaveLength(1);
    });

    it('rejects a script tag in the full content and stores nothing', async (): Promise<void> => {
      const response = await createLaw(
        jsonRequest(url, 'POST', { ...validLaw, fullContent: SCRIPT_TAG }),
      );

      expect(response.status).toBe(400);
      expect(await errorOf(response)).toBe(MARKUP_NOT_ALLOWED_ERROR);
      expect(await storedDocs(COLLECTIONS.LAWS)).toHaveLength(0);
    });

    it('rejects markup in a tag', async (): Promise<void> => {
      const response = await createLaw(
        jsonRequest(url, 'POST', { ...validLaw, tags: [IMG_ONERROR] }),
      );

      expect(response.status).toBe(400);
      expect(await storedDocs(COLLECTIONS.LAWS)).toHaveLength(0);
    });

    it('rejects fields the form does not send', async (): Promise<void> => {
      const response = await createLaw(jsonRequest(url, 'POST', { ...validLaw, order: -1 }));

      expect(response.status).toBe(400);
      expect(await storedDocs(COLLECTIONS.LAWS)).toHaveLength(0);
    });

    it('returns 401 without a token', async (): Promise<void> => {
      const response = await createLaw(jsonRequest(url, 'POST', validLaw, false));

      expect(response.status).toBe(401);
      expect(await storedDocs(COLLECTIONS.LAWS)).toHaveLength(0);
    });
  });

  describe('PUT /api/content/laws/[id]', (): void => {
    const url = `http://localhost:3000/api/content/laws/${LAW_ID}`;
    const context = { params: Promise.resolve({ id: LAW_ID }) };

    beforeEach((): void => {
      setCollectionDocs(COLLECTIONS.LAWS, [{ id: LAW_ID, data: { ...validLaw, order: 0 } }]);
    });

    it('applies a valid partial update', async (): Promise<void> => {
      const response = await updateLaw(jsonRequest(url, 'PUT', { title: 'Edited title' }), context);

      expect(response.status).toBe(200);
      expect((await storedDocs(COLLECTIONS.LAWS))[0]?.title).toBe('Edited title');
    });

    it('rejects markup and leaves the stored law unchanged', async (): Promise<void> => {
      const response = await updateLaw(jsonRequest(url, 'PUT', { title: IMG_ONERROR }), context);

      expect(response.status).toBe(400);
      expect((await storedDocs(COLLECTIONS.LAWS))[0]?.title).toBe(validLaw.title);
    });

    it('rejects an attempt to overwrite fields the form does not send', async (): Promise<void> => {
      const response = await updateLaw(jsonRequest(url, 'PUT', { order: 99 }), context);

      expect(response.status).toBe(400);
      expect((await storedDocs(COLLECTIONS.LAWS))[0]?.order).toBe(0);
    });
  });

  describe('POST /api/content/news', (): void => {
    const url = 'http://localhost:3000/api/content/news';

    it('creates a news item from a valid body', async (): Promise<void> => {
      const response = await createNews(jsonRequest(url, 'POST', validNews));

      expect(response.status).toBe(201);
      expect(await storedDocs(COLLECTIONS.NEWS)).toHaveLength(1);
    });

    it('rejects a javascript: image URL and stores nothing', async (): Promise<void> => {
      const response = await createNews(
        jsonRequest(url, 'POST', { ...validNews, imageUrl: 'javascript:alert(1)' }),
      );

      expect(response.status).toBe(400);
      expect(await errorOf(response)).toBe(IMAGE_URL_ERROR);
      expect(await storedDocs(COLLECTIONS.NEWS)).toHaveLength(0);
    });

    it('rejects markup in the summary', async (): Promise<void> => {
      const response = await createNews(
        jsonRequest(url, 'POST', { ...validNews, summary: SCRIPT_TAG }),
      );

      expect(response.status).toBe(400);
      expect(await storedDocs(COLLECTIONS.NEWS)).toHaveLength(0);
    });

    it('rejects an unparseable publish date instead of failing with a 500', async (): Promise<void> => {
      const response = await createNews(
        jsonRequest(url, 'POST', { ...validNews, publishedAt: 'not-a-date' }),
      );

      expect(response.status).toBe(400);
    });

    it('returns 401 without a token', async (): Promise<void> => {
      const response = await createNews(jsonRequest(url, 'POST', validNews, false));

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/content/news/[id]', (): void => {
    const url = `http://localhost:3000/api/content/news/${NEWS_ID}`;
    const context = { params: Promise.resolve({ id: NEWS_ID }) };

    beforeEach((): void => {
      setCollectionDocs(COLLECTIONS.NEWS, [
        { id: NEWS_ID, data: { ...validNews, publishedAt: ORIGINAL_PUBLISHED_AT } },
      ]);
    });

    it('rejects markup in the title and leaves the stored item unchanged', async (): Promise<void> => {
      const response = await updateNews(jsonRequest(url, 'PUT', { title: IMG_ONERROR }), context);

      expect(response.status).toBe(400);
      expect((await storedDocs(COLLECTIONS.NEWS))[0]?.title).toBe(validNews.title);
    });

    it('rejects a data: image URL', async (): Promise<void> => {
      const response = await updateNews(
        jsonRequest(url, 'PUT', { imageUrl: 'data:text/html,<b>x</b>' }),
        context,
      );

      expect(response.status).toBe(400);
    });

    it('keeps the stored publish date when the form sends an empty one', async (): Promise<void> => {
      const response = await updateNews(
        jsonRequest(url, 'PUT', { title: 'Edited', publishedAt: '' }),
        context,
      );

      expect(response.status).toBe(200);
      const stored = (await storedDocs(COLLECTIONS.NEWS))[0];
      expect(stored?.title).toBe('Edited');
      expect(stored?.publishedAt).toBe(ORIGINAL_PUBLISHED_AT);
    });
  });
});
