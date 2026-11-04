import type { NextRequest } from 'next/server';

import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { lawBodySchema, validationMessage } from '@/lib/content/content-validation';
import { createOrderedContent, listOrderedContent } from '@/lib/content/content.service';
import type { Law } from '@/types/firestore.types';

export async function GET(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const laws = await listOrderedContent<Law>(COLLECTIONS.LAWS);
    return apiOk(laws);
  } catch (error) {
    console.error('GET /api/content/laws failed:', error);
    return apiError('Failed to fetch laws', 500);
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const parsed = lawBodySchema.safeParse(await request.json());
    if (!parsed.success) return apiError(validationMessage(parsed.error), 400);

    const id = await createOrderedContent(COLLECTIONS.LAWS, parsed.data);
    return apiOk({ id }, 201);
  } catch (error) {
    console.error('POST /api/content/laws failed:', error);
    return apiError('Failed to create law', 500);
  }
}
