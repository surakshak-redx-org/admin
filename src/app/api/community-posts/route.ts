import type { Query } from 'firebase-admin/firestore';
import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import type { NextRequest } from 'next/server';

import {
  COMMUNITY_POST_SORTS,
  COMMUNITY_POST_STATUSES,
  COMMUNITY_POSTS_PAGE_SIZE,
} from '@/constants/config';
import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { serializeDoc } from '@/lib/firebase/serialize';
import type { Serialized } from '@/types/api.types';
import type { CommunityPost } from '@/types/firestore.types';

type ClientPost = Serialized<CommunityPost> & { id: string };
type CommunityPostSort = (typeof COMMUNITY_POST_SORTS)[number];
type CommunityPostStatus = (typeof COMMUNITY_POST_STATUSES)[number];

/**
 * Pagination cursor: the last row's sort-field value plus its doc id, rather
 * than the doc id alone. Paging keeps working if that post is deleted between
 * page loads (a bare-id cursor would resolve to nothing and restart from the
 * top), and the id breaks ties between posts sharing a sort value.
 */
interface PostCursor {
  /** `reportCount`, or `createdAt` whole seconds. */
  value: number;
  /** `createdAt` nanoseconds; 0 when sorting by `reportCount`. */
  nanos: number;
  id: string;
}

const MAX_NANOSECONDS = 999_999_999;

function parseSort(raw: string | null): CommunityPostSort {
  return COMMUNITY_POST_SORTS.find((sort) => sort === raw) ?? 'newest';
}

function parseStatus(raw: string | null): CommunityPostStatus {
  return COMMUNITY_POST_STATUSES.find((status) => status === raw) ?? 'all';
}

function encodeCursor(cursor: PostCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(raw: string): PostCursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'value' in parsed &&
      'nanos' in parsed &&
      'id' in parsed &&
      typeof parsed.value === 'number' &&
      Number.isSafeInteger(parsed.value) &&
      typeof parsed.nanos === 'number' &&
      Number.isInteger(parsed.nanos) &&
      parsed.nanos >= 0 &&
      parsed.nanos <= MAX_NANOSECONDS &&
      typeof parsed.id === 'string' &&
      parsed.id.length > 0
    ) {
      return { value: parsed.value, nanos: parsed.nanos, id: parsed.id };
    }
    return null;
  } catch {
    return null;
  }
}

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

    const sort = parseSort(request.nextUrl.searchParams.get('sort'));
    const status = parseStatus(request.nextUrl.searchParams.get('status'));
    const cursorParam = request.nextUrl.searchParams.get('cursor');

    const sortField = sort === 'most-reported' ? 'reportCount' : 'createdAt';
    const direction = sort === 'oldest' ? 'asc' : 'desc';

    let query: Query = adminDb.collection(COLLECTIONS.COMMUNITY);
    if (status !== 'all') query = query.where('isHidden', '==', status === 'hidden');
    query = query
      .orderBy(sortField, direction)
      .orderBy(FieldPath.documentId(), direction)
      .limit(COMMUNITY_POSTS_PAGE_SIZE);

    if (cursorParam) {
      const cursor = decodeCursor(cursorParam);
      if (!cursor) return apiError('Invalid cursor', 400);

      const cursorValue =
        sortField === 'createdAt' ? new Timestamp(cursor.value, cursor.nanos) : cursor.value;
      query = query.startAfter(cursorValue, cursor.id);
    }

    const snap = await query.get();

    const posts = snap.docs.map((doc) => toClientPost(doc.id, doc.data() as CommunityPost));

    const lastDoc = snap.docs[snap.docs.length - 1];
    let nextCursor: string | null = null;
    if (snap.docs.length === COMMUNITY_POSTS_PAGE_SIZE && lastDoc) {
      const lastPost = lastDoc.data() as CommunityPost;
      nextCursor = encodeCursor(
        sortField === 'createdAt'
          ? {
              value: lastPost.createdAt.seconds,
              nanos: lastPost.createdAt.nanoseconds,
              id: lastDoc.id,
            }
          : { value: lastPost.reportCount, nanos: 0, id: lastDoc.id },
      );
    }

    return apiOk({ posts, nextCursor });
  } catch (error) {
    console.error('GET /api/community-posts failed:', error);
    return apiError('Failed to fetch community posts', 500);
  }
}
