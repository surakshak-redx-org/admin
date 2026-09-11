import type { NextRequest } from 'next/server';

import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import type { DashboardStats } from '@/types/firestore.types';

export async function GET(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const [
      totalUsers,
      totalPosts,
      hiddenPosts,
      pendingUnsafeAreas,
      openIncidents,
      publishedLaws,
      publishedNews,
    ] = await Promise.all([
      adminDb.collection(COLLECTIONS.USERS).count().get(),
      adminDb.collection(COLLECTIONS.COMMUNITY).count().get(),
      adminDb.collection(COLLECTIONS.COMMUNITY).where('isHidden', '==', true).count().get(),
      adminDb.collection(COLLECTIONS.UNSAFE_AREAS).where('status', '==', 'pending').count().get(),
      adminDb
        .collection(COLLECTIONS.INCIDENT_REPORTS)
        .where('status', '!=', 'resolved')
        .count()
        .get(),
      adminDb.collection(COLLECTIONS.LAWS).where('isPublished', '==', true).count().get(),
      adminDb.collection(COLLECTIONS.NEWS).where('isPublished', '==', true).count().get(),
    ]);

    const stats: DashboardStats = {
      totalUsers: totalUsers.data().count,
      totalPosts: totalPosts.data().count,
      hiddenPosts: hiddenPosts.data().count,
      pendingUnsafeAreas: pendingUnsafeAreas.data().count,
      openIncidents: openIncidents.data().count,
      publishedLaws: publishedLaws.data().count,
      publishedNews: publishedNews.data().count,
    };

    return apiOk(stats);
  } catch (error) {
    console.error('GET /api/stats failed:', error);
    return apiError('Failed to fetch stats', 500);
  }
}
