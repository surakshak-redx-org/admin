import type { NextRequest } from 'next/server';

import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { serializeDoc } from '@/lib/firebase/serialize';
import type { Serialized } from '@/types/api.types';
import type { CommunityPost } from '@/types/firestore.types';

const MODERATION_LIST_FIELDS = [
  'authorName',
  'content',
  'type',
  'isAnonymous',
  'city',
  'reportCount',
  'createdAt',
] as const;

export async function GET(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const snap = await adminDb
      .collection(COLLECTIONS.COMMUNITY)
      .where('isHidden', '==', true)
      .orderBy('reportCount', 'desc')
      .select(...MODERATION_LIST_FIELDS)
      .get();

    const posts = snap.docs.map(
      (doc) => serializeDoc({ id: doc.id, ...doc.data() }) as Serialized<CommunityPost>,
    );
    return apiOk(posts);
  } catch (error) {
    console.error('GET /api/moderation failed:', error);
    return apiError('Failed to fetch hidden posts', 500);
  }
}
