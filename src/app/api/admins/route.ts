import { FieldValue } from 'firebase-admin/firestore';
import type { NextRequest } from 'next/server';

import { ADMIN_ROLES, COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { requireSuperAdmin } from '@/lib/auth/middleware';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { serializeDoc } from '@/lib/firebase/serialize';
import type { Serialized } from '@/types/api.types';
import type { AdminUser } from '@/types/firestore.types';

const ADMIN_LIST_FIELDS = ['uid', 'email', 'displayName', 'photoUrl', 'role', 'createdAt'] as const;

export async function GET(request: NextRequest): Promise<Response> {
  const check = await requireSuperAdmin(request);
  if (!check.ok) return check.response;

  try {
    const snap = await adminDb
      .collection(COLLECTIONS.ADMINS)
      .orderBy('createdAt', 'asc')
      .select(...ADMIN_LIST_FIELDS)
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
  const check = await requireSuperAdmin(request);
  if (!check.ok) return check.response;

  try {
    const { email } = (await request.json()) as Partial<AddAdminBody>;
    if (typeof email !== 'string' || email.trim() === '') {
      return apiError('Email is required', 400);
    }

    let firebaseUser;
    try {
      firebaseUser = await adminAuth.getUserByEmail(email);
    } catch {
      return apiError('No Surakshak account with this email', 404);
    }

    const ref = adminDb.collection(COLLECTIONS.ADMINS).doc(firebaseUser.uid);
    // `set` replaces the whole document, so adding an existing admin would
    // silently demote a super_admin to `admin`.
    if ((await ref.get()).exists) return apiError('This user is already an admin', 409);

    await ref.set({
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? email,
      displayName: firebaseUser.displayName ?? email,
      photoUrl: firebaseUser.photoURL ?? '',
      role: ADMIN_ROLES.ADMIN,
      createdAt: FieldValue.serverTimestamp(),
    });

    const created = await ref.get();
    return apiOk(serializeDoc(created.data() ?? {}) as Serialized<AdminUser>, 201);
  } catch (error) {
    console.error('POST /api/admins failed:', error);
    return apiError('Failed to add admin', 500);
  }
}
