import type { NextRequest } from 'next/server';

import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const { id } = await context.params;
    const ref = adminDb.collection(COLLECTIONS.COMMUNITY).doc(id);
    const doc = await ref.get();

    if (!doc.exists) return apiError('Post not found', 404);

    await ref.delete();

    return apiOk({ id, deleted: true });
  } catch (error) {
    console.error('DELETE /api/community-posts/[id] failed:', error);
    return apiError('Failed to delete post', 500);
  }
}
