import type { NextRequest } from 'next/server';

import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { serializeDoc } from '@/lib/firebase/serialize';
import type { Serialized } from '@/types/api.types';
import type { SurakshakUser, UnsafeArea } from '@/types/firestore.types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const { id } = await context.params;
    const doc = await adminDb.collection(COLLECTIONS.UNSAFE_AREAS).doc(id).get();
    if (!doc.exists) return apiError('Unsafe area not found', 404);

    const area = serializeDoc({ id: doc.id, ...doc.data() }) as Serialized<UnsafeArea>;

    let reporter: Pick<SurakshakUser, 'name' | 'city'> | null = null;
    const reporterDoc = await adminDb.collection(COLLECTIONS.USERS).doc(area.reportedBy).get();
    if (reporterDoc.exists) {
      const data = reporterDoc.data() as SurakshakUser;
      reporter = { name: data.name, city: data.city };
    }

    return apiOk({ area, reporter });
  } catch (error) {
    console.error('GET /api/unsafe-areas/[id] failed:', error);
    return apiError('Failed to fetch unsafe area', 500);
  }
}

interface UnsafeAreaActionBody {
  action: 'approve' | 'reject';
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const { id } = await context.params;
    const { action } = (await request.json()) as UnsafeAreaActionBody;
    const ref = adminDb.collection(COLLECTIONS.UNSAFE_AREAS).doc(id);

    if (action === 'approve') {
      await ref.update({ status: 'approved', pinColor: 'red' });
      return apiOk({ id, status: 'approved' });
    }

    if (action === 'reject') {
      await ref.delete();
      return apiOk({ id, deleted: true });
    }

    return apiError('Invalid action', 400);
  } catch (error) {
    console.error('PATCH /api/unsafe-areas/[id] failed:', error);
    return apiError('Failed to update unsafe area', 500);
  }
}
