import type { NextRequest } from 'next/server';

import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { serializeDoc } from '@/lib/firebase/serialize';
import type { Serialized } from '@/types/api.types';
import type { CommunityPost } from '@/types/firestore.types';

type ClientPost = Serialized<CommunityPost> & { id: string };

export async function GET(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const snap = await adminDb
      .collection(COLLECTIONS.COMMUNITY)
      .orderBy('createdAt', 'desc')
      .get();

    const posts = snap.docs.map(
      (doc) =>
        ({
          ...serializeDoc(doc.data()),
          id: doc.id,
        }) as ClientPost,
    );

    return apiOk(posts);
  } catch (error) {
    console.error('GET /api/community-posts failed:', error);
    return apiError('Failed to fetch community posts', 500);
  }
}
