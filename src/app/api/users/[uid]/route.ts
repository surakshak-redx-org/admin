import type { NextRequest } from 'next/server';

import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { serializeDoc } from '@/lib/firebase/serialize';
import type { Serialized } from '@/types/api.types';
import type { SurakshakUser } from '@/types/firestore.types';

interface RouteContext {
  params: Promise<{ uid: string }>;
}

type PublicUser = Omit<SurakshakUser, 'phone'>;

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const { uid } = await context.params;
    const doc = await adminDb.collection(COLLECTIONS.USERS).doc(uid).get();
    if (!doc.exists) return apiError('User not found', 404);

    const data = doc.data() as SurakshakUser;
    const user = serializeDoc({
      id: doc.id,
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

    const [postCount, incidentCount] = await Promise.all([
      adminDb.collection(COLLECTIONS.COMMUNITY).where('authorId', '==', uid).count().get(),
      adminDb.collection(COLLECTIONS.INCIDENT_REPORTS).where('userId', '==', uid).count().get(),
    ]);

    return apiOk({
      user,
      postCount: postCount.data().count,
      incidentCount: incidentCount.data().count,
    });
  } catch (error) {
    console.error('GET /api/users/[uid] failed:', error);
    return apiError('Failed to fetch user', 500);
  }
}

interface UserActionBody {
  action: 'suspend';
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const { uid } = await context.params;
    const { action } = (await request.json()) as UserActionBody;

    if (action !== 'suspend') return apiError('Invalid action', 400);

    await adminDb.collection(COLLECTIONS.USERS).doc(uid).update({ isSuspended: true });
    return apiOk({ id: uid, isSuspended: true });
  } catch (error) {
    console.error('PATCH /api/users/[uid] failed:', error);
    return apiError('Failed to suspend user', 500);
  }
}
