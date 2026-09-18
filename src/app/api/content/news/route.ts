import { Timestamp } from 'firebase-admin/firestore';
import type { NextRequest } from 'next/server';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/constants/config';
import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { serializeDoc } from '@/lib/firebase/serialize';
import type { Serialized } from '@/types/api.types';
import type { NewsItem } from '@/types/firestore.types';

const NEWS_LIST_FIELDS = [
  'title',
  'summary',
  'content',
  'imageUrl',
  'category',
  'publishedAt',
  'isPublished',
] as const;

export async function GET(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = Math.min(Math.max(1, Number(limitParam) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

    const snap = await adminDb
      .collection(COLLECTIONS.NEWS)
      .orderBy('publishedAt', 'desc')
      .select(...NEWS_LIST_FIELDS)
      .limit(limit)
      .get();
    const news = snap.docs.map(
      (doc) => serializeDoc({ id: doc.id, ...doc.data() }) as Serialized<NewsItem>,
    );
    return apiOk(news);
  } catch (error) {
    console.error('GET /api/content/news failed:', error);
    return apiError('Failed to fetch news', 500);
  }
}

interface CreateNewsBody {
  title: string;
  summary: string;
  content: string;
  imageUrl: string;
  category: string;
  isPublished: boolean;
  publishedAt?: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const body = (await request.json()) as CreateNewsBody;
    const publishedAt = body.publishedAt
      ? Timestamp.fromDate(new Date(body.publishedAt))
      : Timestamp.now();
    const ref = await adminDb.collection(COLLECTIONS.NEWS).add({ ...body, publishedAt });
    return apiOk({ id: ref.id }, 201);
  } catch (error) {
    console.error('POST /api/content/news failed:', error);
    return apiError('Failed to create news item', 500);
  }
}
