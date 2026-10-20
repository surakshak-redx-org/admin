import type { NextRequest } from 'next/server';

import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { serializeDoc } from '@/lib/firebase/serialize';
import type { Serialized } from '@/types/api.types';
import type { IncidentReport, SurakshakUser } from '@/types/firestore.types';

const INCIDENT_LIST_FIELDS = [
  'userId',
  'title',
  'description',
  'latitude',
  'longitude',
  'photoUrls',
  'createdAt',
  'status',
  'category',
  'adminNote',
] as const;

const DEFAULT_RECENT_LIMIT = 10;
const MAX_RECENT_LIMIT = 25;
const OPEN_INCIDENT_STATUSES = ['submitted', 'under_review'] as const;

export async function GET(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const status = request.nextUrl.searchParams.get('status');
    const isUnresolvedQuery = status === 'unresolved';
    const requestedLimit = request.nextUrl.searchParams.get('limit');

    if (requestedLimit !== null && !/^[1-9]\d*$/.test(requestedLimit)) {
      return apiError('Invalid limit', 400);
    }

    const limit =
      requestedLimit === null
        ? isUnresolvedQuery
          ? DEFAULT_RECENT_LIMIT
          : undefined
        : Math.min(Number(requestedLimit), MAX_RECENT_LIMIT);

    let query = adminDb.collection(COLLECTIONS.INCIDENT_REPORTS).orderBy('createdAt', 'desc');

    if (isUnresolvedQuery) {
      query = adminDb
        .collection(COLLECTIONS.INCIDENT_REPORTS)
        .where('status', 'in', [...OPEN_INCIDENT_STATUSES])
        .orderBy('createdAt', 'desc');
    } else if (
      status === 'submitted' ||
      status === 'under_review' ||
      status === 'resolved' ||
      status === 'rejected'
    ) {
      query = adminDb
        .collection(COLLECTIONS.INCIDENT_REPORTS)
        .where('status', '==', status)
        .orderBy('createdAt', 'desc');
    }

    if (limit !== undefined) query = query.limit(limit);

    query = query.select(...INCIDENT_LIST_FIELDS);

    const snap = await query.get();
    const reports = snap.docs.map(
      (doc) => serializeDoc({ id: doc.id, ...doc.data() }) as Serialized<IncidentReport>,
    );

    const userIds = Array.from(new Set(reports.map((r) => r.userId).filter(Boolean)));
    const userDocs =
      userIds.length > 0
        ? await adminDb.getAll(
            ...userIds.map((uid) => adminDb.collection(COLLECTIONS.USERS).doc(uid)),
            { fieldMask: ['name', 'city'] },
          )
        : [];
    const usersById = new Map<string, Pick<SurakshakUser, 'name' | 'city'>>();
    userDocs.forEach((doc) => {
      if (doc.exists) {
        const data = doc.data() as SurakshakUser;
        usersById.set(doc.id, { name: data.name, city: data.city });
      }
    });

    const reportsWithUser = reports.map((report) => ({
      ...report,
      user: usersById.get(report.userId) ?? null,
    }));

    return apiOk(reportsWithUser);
  } catch (error) {
    console.error('GET /api/incidents failed:', error);
    return apiError('Failed to fetch incident reports', 500);
  }
}
