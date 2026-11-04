import { Timestamp } from 'firebase-admin/firestore';
import type { NextRequest } from 'next/server';

import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { newsUpdateSchema, validationMessage } from '@/lib/content/content-validation';
import { applyPublishPatch } from '@/lib/content/content.service';
import { adminDb } from '@/lib/firebase/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, context: RouteContext): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const { id } = await context.params;
    const parsed = newsUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(validationMessage(parsed.error), 400);

    const { publishedAt, ...fields } = parsed.data;
    const update: Record<string, unknown> = { ...fields };
    if (publishedAt) {
      update.publishedAt = Timestamp.fromDate(new Date(publishedAt));
    }
    await adminDb.collection(COLLECTIONS.NEWS).doc(id).update(update);
    return apiOk({ id });
  } catch (error) {
    console.error('PUT /api/content/news/[id] failed:', error);
    return apiError('Failed to update news item', 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const { id } = await context.params;
    await adminDb.collection(COLLECTIONS.NEWS).doc(id).delete();
    return apiOk({ id });
  } catch (error) {
    console.error('DELETE /api/content/news/[id] failed:', error);
    return apiError('Failed to delete news item', 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const { id } = await context.params;
    const isPublished = await applyPublishPatch(request, COLLECTIONS.NEWS, id);
    return apiOk({ id, isPublished });
  } catch (error) {
    console.error('PATCH /api/content/news/[id] failed:', error);
    return apiError('Failed to toggle news item', 500);
  }
}
