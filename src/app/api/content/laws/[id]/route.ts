import type { NextRequest } from 'next/server';

import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import {
  deleteContent,
  toggleContentPublished,
  updateContent,
} from '@/lib/content/content.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, context: RouteContext): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    await updateContent(COLLECTIONS.LAWS, id, body);
    return apiOk({ id });
  } catch (error) {
    console.error('PUT /api/content/laws/[id] failed:', error);
    return apiError('Failed to update law', 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const { id } = await context.params;
    await deleteContent(COLLECTIONS.LAWS, id);
    return apiOk({ id });
  } catch (error) {
    console.error('DELETE /api/content/laws/[id] failed:', error);
    return apiError('Failed to delete law', 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const { id } = await context.params;
    const isPublished = await toggleContentPublished(COLLECTIONS.LAWS, id);
    return apiOk({ id, isPublished });
  } catch (error) {
    console.error('PATCH /api/content/laws/[id] failed:', error);
    return apiError('Failed to toggle law', 500);
  }
}
