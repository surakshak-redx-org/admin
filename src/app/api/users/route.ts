import type { NextRequest } from 'next/server';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/constants/config';
import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { serializeDoc } from '@/lib/firebase/serialize';
import type { Serialized } from '@/types/api.types';
import type { SurakshakUser } from '@/types/firestore.types';

/** `SurakshakUser` with `phone` stripped — never sent to the client. */
type PublicUser = Omit<SurakshakUser, 'phone'>;

const PUBLIC_USER_FIELDS = [
  'userId',
  'name',
  'profilePhotoUrl',
  'city',
  'state',
  'language',
  'isGuest',
  'isSuspended',
  'createdAt',
  'updatedAt',
] as const;

function toPublicUser(id: string, data: SurakshakUser): Serialized<PublicUser> {
  return serializeDoc({
    id,
    userId: data.userId,
    name: data.name,
    profilePhotoUrl: data.profilePhotoUrl,
    city: data.city,
    state: data.state,
    language: data.language,
    isGuest: data.isGuest,
    isSuspended: data.isSuspended,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }) as Serialized<PublicUser>;
}

export async function GET(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const search = request.nextUrl.searchParams.get('search')?.trim().toLowerCase() ?? '';
    const cursor = request.nextUrl.searchParams.get('cursor');
    const limitParam = request.nextUrl.searchParams.get('limit');
    const pageSize = Math.min(
      Math.max(1, Number(limitParam) || DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    );

    if (search) {
      // Firestore has no case-insensitive "contains" query — fetch a bounded,
      // recent window and filter in memory. Pagination is disabled while
      // searching; fine at this data scale, revisit if the user base grows.
      const snap = await adminDb
        .collection(COLLECTIONS.USERS)
        .orderBy('createdAt', 'desc')
        .select(...PUBLIC_USER_FIELDS)
        .limit(pageSize * 4)
        .get();

      const matches = snap.docs
        .map((doc) => toPublicUser(doc.id, doc.data() as SurakshakUser))
        .filter(
          (user) =>
            user.name.toLowerCase().includes(search) || user.city.toLowerCase().includes(search),
        )
        .slice(0, pageSize);

      return apiOk({ users: matches, nextCursor: null });
    }

    let query = adminDb
      .collection(COLLECTIONS.USERS)
      .orderBy('createdAt', 'desc')
      .select(...PUBLIC_USER_FIELDS)
      .limit(pageSize);
    if (cursor) {
      const cursorDoc = await adminDb.collection(COLLECTIONS.USERS).doc(cursor).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }

    const snap = await query.get();
    const users = snap.docs.map((doc) => toPublicUser(doc.id, doc.data() as SurakshakUser));
    const lastDoc = snap.docs[snap.docs.length - 1];
    const nextCursor = snap.docs.length === pageSize && lastDoc ? lastDoc.id : null;

    return apiOk({ users, nextCursor });
  } catch (error) {
    console.error('GET /api/users failed:', error);
    return apiError('Failed to fetch users', 500);
  }
}
