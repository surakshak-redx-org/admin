import type { NextRequest } from 'next/server';

import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { serializeDoc } from '@/lib/firebase/serialize';
import type { Serialized } from '@/types/api.types';
import type { AdminUser } from '@/types/firestore.types';

export async function GET(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  return apiOk(serializeDoc(session.admin) as Serialized<AdminUser>);
}
