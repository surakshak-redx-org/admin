import type { NextRequest } from 'next/server';

import { COMMUNITY_POSTS_PAGE_SIZE } from '@/constants/config';
import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { serializeDoc } from '@/lib/firebase/serialize';
import type { Serialized } from '@/types/api.types';
import type { CommunityPost } from '@/types/firestore.types';

type ClientPost = Serialized<CommunityPost> & { id: string };

function toClientPost(id: string, data: CommunityPost): ClientPost {
  return {
    ...serializeDoc(data),
    id,
  } as ClientPost;
}

export async function GET(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const search = request.nextUrl.searchParams.get('search')?.trim().toLowerCase() ?? '';
    const cursor = request.nextUrl.searchParams.get('cursor');

    if (search) {
      const snap = await adminDb
        .collection(COLLECTIONS.COMMUNITY)
        .orderBy('createdAt', 'desc')
        .limit(COMMUNITY_POSTS_PAGE_SIZE * 4)
        .get();

      const matches = snap.docs
        .map((doc) => toClientPost(doc.id, doc.data() as CommunityPost))
        .filter(
          (post) =>
            post.content.toLowerCase().includes(search) ||
            (!post.isAnonymous && post.authorName.toLowerCase().includes(search)) ||
            post.city.toLowerCase().includes(search),
        )
        .slice(0, COMMUNITY_POSTS_PAGE_SIZE);

      return apiOk({ posts: matches, nextCursor: null });
    }

    let query = adminDb
      .collection(COLLECTIONS.COMMUNITY)
      .orderBy('createdAt', 'desc')
      .limit(COMMUNITY_POSTS_PAGE_SIZE);

    if (cursor) {
      const cursorDoc = await adminDb.collection(COLLECTIONS.COMMUNITY).doc(cursor).get();

      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snap = await query.get();

    const posts = snap.docs.map((doc) => toClientPost(doc.id, doc.data() as CommunityPost));

    const lastDoc = snap.docs[snap.docs.length - 1];
    const nextCursor =
      snap.docs.length === COMMUNITY_POSTS_PAGE_SIZE && lastDoc ? lastDoc.id : null;

    return apiOk({ posts, nextCursor });
  } catch (error) {
    console.error('GET /api/community-posts failed:', error);
    return apiError('Failed to fetch community posts', 500);
  }
}
