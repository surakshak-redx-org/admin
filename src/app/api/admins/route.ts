import { FieldValue } from 'firebase-admin/firestore';
import type { NextRequest } from 'next/server';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/constants/config';
import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { forbiddenResponse, verifyAdminToken } from '@/lib/auth/middleware';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { serializeDoc } from '@/lib/firebase/serialize';
import type { Serialized } from '@/types/api.types';
import type { AdminUser } from '@/types/firestore.types';

const ADMIN_LIST_FIELDS = [
  'uid',
  'email',
  'displayName',
  'photoUrl',
  'role',
  'createdAt',
] as const;

export async function GET(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);
  if (session.admin.role !== 'super_admin') return forbiddenResponse();

  try {
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = Math.min(
      Math.max(1, Number(limitParam) || DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    );

    const snap = await adminDb
      .collection(COLLECTIONS.ADMINS)
      .orderBy('createdAt', 'asc')
      .select(...ADMIN_LIST_FIELDS)
      .limit(limit)
      .get();
    const admins = snap.docs.map((doc) => serializeDoc(doc.data()) as Serialized<AdminUser>);
    return apiOk(admins);
  } catch (error) {
    console.error('GET /api/admins failed:', error);
    return apiError('Failed to fetch admins', 500);
  }
}

interface AddAdminBody {
  email: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);
  if (session.admin.role !== 'super_admin') return forbiddenResponse();

  try {
    const { email } = (await request.json()) as AddAdminBody;

    let firebaseUser;
    try {
      firebaseUser = await adminAuth.getUserByEmail(email);
    } catch {
      return apiError('No Surakshak account with this email', 404);
    }

    const ref = adminDb.collection(COLLECTIONS.ADMINS).doc(firebaseUser.uid);
    await ref.set({
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? email,
      displayName: firebaseUser.displayName ?? email,
      photoUrl: firebaseUser.photoURL ?? '',
      role: 'admin',
      createdAt: FieldValue.serverTimestamp(),
    });

    const created = await ref.get();
    return apiOk(serializeDoc(created.data() ?? {}) as Serialized<AdminUser>, 201);
  } catch (error) {
    console.error('POST /api/admins failed:', error);
    return apiError('Failed to add admin', 500);
  }
}
