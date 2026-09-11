import type { NextRequest } from 'next/server';

import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { createOrderedContent, listOrderedContent } from '@/lib/content/content.service';
import type { SafetyTip } from '@/types/firestore.types';

export async function GET(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const tips = await listOrderedContent<SafetyTip>(COLLECTIONS.SAFETY_TIPS);
    return apiOk(tips);
  } catch (error) {
    console.error('GET /api/content/tips failed:', error);
    return apiError('Failed to fetch safety tips', 500);
  }
}

interface CreateTipBody {
  title: string;
  content: string;
  category: string;
  isPublished: boolean;
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const body = (await request.json()) as CreateTipBody;
    const id = await createOrderedContent(COLLECTIONS.SAFETY_TIPS, body);
    return apiOk({ id }, 201);
  } catch (error) {
    console.error('POST /api/content/tips failed:', error);
    return apiError('Failed to create safety tip', 500);
  }
}
