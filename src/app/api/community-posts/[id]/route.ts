import type { NextRequest } from 'next/server';

import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import {
  deletePostWithAudit,
  parseReason,
  readJsonBody,
  REASON_ERROR,
} from '@/lib/moderation/audit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const { id } = await context.params;
    const reason = parseReason(await readJsonBody(request));
    if (!reason) return apiError(REASON_ERROR, 400);

    const deleted = await deletePostWithAudit(
      id,
      { uid: session.uid, email: session.admin.email },
      reason,
    );
    if (!deleted) return apiError('Post not found', 404);

    return apiOk({ id, deleted: true });
  } catch (error) {
    console.error('DELETE /api/community-posts/[id] failed:', error);
    return apiError('Failed to delete post', 500);
  }
}
