import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { ADMIN_ROLES } from '@/constants/firestore';
import { apiError } from '@/lib/api/response';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import type { AdminRole, AdminUser } from '@/types/firestore.types';

export interface AdminSession {
  uid: string;
  admin: AdminUser;
}

export type SuperAdminCheck =
  { ok: true; session: AdminSession } | { ok: false; response: NextResponse };

export async function verifyAdminToken(request: NextRequest): Promise<AdminSession | null> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return null;

  const token = authorization.split('Bearer ')[1];
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const adminDoc = await adminDb.collection('admins').doc(decoded.uid).get();

    if (!adminDoc.exists) return null;

    const data = adminDoc.data() ?? {};
    // Least privilege: anything other than an exact `super_admin` (missing,
    // misspelled or unknown role) is a standard admin. `uid` always comes from
    // the verified token, never from a field inside the document.
    const role: AdminRole =
      data['role'] === ADMIN_ROLES.SUPER_ADMIN ? ADMIN_ROLES.SUPER_ADMIN : ADMIN_ROLES.ADMIN;

    return {
      uid: decoded.uid,
      admin: { ...data, uid: decoded.uid, role } as AdminUser,
    };
  } catch {
    return null;
  }
}

/**
 * Single entry point for routes that only a `super_admin` may call. Returns the
 * session, or the 401/403 response the route must return as-is.
 */
export async function requireSuperAdmin(request: NextRequest): Promise<SuperAdminCheck> {
  const session = await verifyAdminToken(request);
  if (!session) return { ok: false, response: apiError('Unauthorized', 401) };
  if (session.admin.role !== ADMIN_ROLES.SUPER_ADMIN) {
    return { ok: false, response: apiError('Forbidden', 403) };
  }
  return { ok: true, session };
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
}

export function forbiddenResponse(): NextResponse {
  return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
}
