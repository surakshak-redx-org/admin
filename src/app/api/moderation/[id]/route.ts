import type { NextRequest } from 'next/server';

import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { serializeDoc } from '@/lib/firebase/serialize';
import { deletePostWithAudit, parseReason, REASON_ERROR } from '@/lib/moderation/audit';
import type { Serialized } from '@/types/api.types';
import type { CommunityPost } from '@/types/firestore.types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const { id } = await context.params;
    const doc = await adminDb.collection(COLLECTIONS.COMMUNITY).doc(id).get();
    if (!doc.exists) return apiError('Post not found', 404);
    return apiOk(serializeDoc({ id: doc.id, ...doc.data() }) as Serialized<CommunityPost>);
  } catch (error) {
    console.error('GET /api/moderation/[id] failed:', error);
    return apiError('Failed to fetch post', 500);
  }
}

interface ModerationActionBody {
  action: 'restore' | 'delete';
  reason?: unknown;
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const { id } = await context.params;
    const body = (await request.json()) as ModerationActionBody;
    const { action } = body;
    const ref = adminDb.collection(COLLECTIONS.COMMUNITY).doc(id);

    if (action === 'restore') {
      await ref.update({ isHidden: false, reportCount: 0 });
      return apiOk({ id, restored: true });
    }

    if (action === 'delete') {
      const reason = parseReason(body);
      if (!reason) return apiError(REASON_ERROR, 400);

      const deleted = await deletePostWithAudit(
        id,
        { uid: session.uid, email: session.admin.email },
        reason,
      );
      if (!deleted) return apiError('Post not found', 404);

      return apiOk({ id, deleted: true });
    }

    return apiError('Invalid action', 400);
  } catch (error) {
    console.error('PATCH /api/moderation/[id] failed:', error);
    return apiError('Failed to update post', 500);
  }
}
