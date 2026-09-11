import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { adminAuth, adminDb } from '@/lib/firebase/admin';
import type { AdminUser } from '@/types/firestore.types';

export async function verifyAdminToken(
  request: NextRequest,
): Promise<{ uid: string; admin: AdminUser } | null> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;

  const token = authorization.split('Bearer ')[1];
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const adminDoc = await adminDb.collection('admins').doc(decoded.uid).get();

    if (!adminDoc.exists) return null;

    return {
      uid: decoded.uid,
      admin: { uid: decoded.uid, ...adminDoc.data() } as AdminUser,
    };
  } catch {
    return null;
  }
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
}

export function forbiddenResponse(): NextResponse {
  return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
}
