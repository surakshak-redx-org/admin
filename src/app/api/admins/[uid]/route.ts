import type { NextRequest } from 'next/server';

import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { requireSuperAdmin } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';

interface RouteContext {
  params: Promise<{ uid: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const check = await requireSuperAdmin(request);
  if (!check.ok) return check.response;
  const { session } = check;

  try {
    const { uid } = await context.params;
    if (uid === session.uid) return apiError('Cannot remove yourself as admin', 400);

    await adminDb.collection(COLLECTIONS.ADMINS).doc(uid).delete();
    return apiOk({ uid, removed: true });
  } catch (error) {
    console.error('DELETE /api/admins/[uid] failed:', error);
    return apiError('Failed to remove admin', 500);
  }
}
