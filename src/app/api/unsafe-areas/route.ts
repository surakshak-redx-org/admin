import type { NextRequest } from 'next/server';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/constants/config';
import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { serializeDoc } from '@/lib/firebase/serialize';
import type { Serialized } from '@/types/api.types';
import type { UnsafeArea, UnsafeAreaStatus } from '@/types/firestore.types';

const UNSAFE_AREA_LIST_FIELDS = [
  'title',
  'category',
  'latitude',
  'longitude',
  'reportedBy',
  'createdAt',
  'status',
  'upvotes',
  'downvotes',
] as const;

export async function GET(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const status = request.nextUrl.searchParams.get('status') as UnsafeAreaStatus | 'all' | null;
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = Math.min(Math.max(1, Number(limitParam) || DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const cursor = request.nextUrl.searchParams.get('cursor');

    let query = adminDb.collection(COLLECTIONS.UNSAFE_AREAS).orderBy('createdAt', 'desc');
    if (status === 'pending' || status === 'approved') {
      query = adminDb
        .collection(COLLECTIONS.UNSAFE_AREAS)
        .where('status', '==', status)
        .orderBy('createdAt', 'desc');
    }

    query = query.select(...UNSAFE_AREA_LIST_FIELDS);

    if (cursor) {
      const cursorDoc = await adminDb.collection(COLLECTIONS.UNSAFE_AREAS).doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snap = await query.limit(limit).get();
    const areas = snap.docs.map(
      (doc) => serializeDoc({ id: doc.id, ...doc.data() }) as Serialized<UnsafeArea>,
    );
    return apiOk(areas);
  } catch (error) {
    console.error('GET /api/unsafe-areas failed:', error);
    return apiError('Failed to fetch unsafe areas', 500);
  }
}
