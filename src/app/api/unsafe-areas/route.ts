import type { NextRequest } from 'next/server';

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

    let query = adminDb.collection(COLLECTIONS.UNSAFE_AREAS).orderBy('createdAt', 'desc');
    if (status === 'pending' || status === 'approved') {
      query = adminDb
        .collection(COLLECTIONS.UNSAFE_AREAS)
        .where('status', '==', status)
        .orderBy('createdAt', 'desc');
    }

    query = query.select(...UNSAFE_AREA_LIST_FIELDS);

    const snap = await query.get();
    const areas = snap.docs.map(
      (doc) => serializeDoc({ id: doc.id, ...doc.data() }) as Serialized<UnsafeArea>,
    );
    return apiOk(areas);
  } catch (error) {
    console.error('GET /api/unsafe-areas failed:', error);
    return apiError('Failed to fetch unsafe areas', 500);
  }
}
