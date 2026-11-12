import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}
const updateSchema = z
  .object({
    status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
    adminNotes: z.string().max(4000).optional(),
  })
  .strict()
  .refine((value) => value.status !== undefined || value.adminNotes !== undefined);

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  if (!(await verifyAdminToken(request))) return apiError('Unauthorized', 401);
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return apiError('Invalid update fields', 400);
  const { id } = await context.params;
  try {
    const ref = adminDb.collection(COLLECTIONS.BUG_REPORTS).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return apiError('Bug report not found', 404);
    await ref.update({ ...parsed.data, updatedAt: new Date() });
    return apiOk({ id, ...parsed.data });
  } catch (error) {
    console.error('PATCH /api/bug-reports/[id] failed:', error);
    return apiError('Failed to update bug report', 500);
  }
}
