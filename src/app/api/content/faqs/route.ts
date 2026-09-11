import type { NextRequest } from 'next/server';

import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { createOrderedContent, listOrderedContent } from '@/lib/content/content.service';
import type { FAQ } from '@/types/firestore.types';

export async function GET(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const faqs = await listOrderedContent<FAQ>(COLLECTIONS.FAQS);
    return apiOk(faqs);
  } catch (error) {
    console.error('GET /api/content/faqs failed:', error);
    return apiError('Failed to fetch FAQs', 500);
  }
}

interface CreateFaqBody {
  question: string;
  answer: string;
  category: string;
  isPublished: boolean;
}

export async function POST(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const body = (await request.json()) as CreateFaqBody;
    const id = await createOrderedContent(COLLECTIONS.FAQS, body);
    return apiOk({ id }, 201);
  } catch (error) {
    console.error('POST /api/content/faqs failed:', error);
    return apiError('Failed to create FAQ', 500);
  }
}
