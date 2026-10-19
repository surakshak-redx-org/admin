import { Timestamp } from 'firebase-admin/firestore';
import type { NextRequest } from 'next/server';

import { NEW_INCIDENT_POLL_LIMIT } from '@/constants/config';
import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { serializeDoc } from '@/lib/firebase/serialize';
import type { LatestIncidentsResponse, NewIncidentSummary } from '@/services/incidents.service';
import type { SurakshakUser } from '@/types/firestore.types';

const LATEST_INCIDENT_FIELDS = ['userId', 'title', 'createdAt'] as const;

/** Firestore timestamps are finer than a millisecond; skip the cursor's own millisecond. */
const CURSOR_EXCLUSIVE_OFFSET_MS = 1;

function readCreatedAt(data: Record<string, unknown>): string | null {
  const createdAt = serializeDoc(data)['createdAt'];
  return typeof createdAt === 'string' ? createdAt : null;
}

export async function GET(request: NextRequest): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const since = request.nextUrl.searchParams.get('since');
    const incidents = adminDb.collection(COLLECTIONS.INCIDENT_REPORTS);

    // First call: hand back a starting point only, so existing reports are not "new".
    if (!since) {
      const newest = await incidents
        .orderBy('createdAt', 'desc')
        .limit(1)
        .select('createdAt')
        .get();
      const newestCreatedAt = newest.docs[0] ? readCreatedAt(newest.docs[0].data()) : null;
      const baseline: LatestIncidentsResponse = {
        incidents: [],
        cursor: newestCreatedAt ?? new Date().toISOString(),
      };
      return apiOk(baseline);
    }

    const sinceMs = Date.parse(since);
    if (Number.isNaN(sinceMs)) return apiError('Invalid "since" value', 400);

    const snap = await incidents
      .where('createdAt', '>', Timestamp.fromMillis(sinceMs + CURSOR_EXCLUSIVE_OFFSET_MS))
      .orderBy('createdAt', 'desc')
      .limit(NEW_INCIDENT_POLL_LIMIT)
      .select(...LATEST_INCIDENT_FIELDS)
      .get();

    const rows = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: typeof data['userId'] === 'string' ? data['userId'] : '',
        title: typeof data['title'] === 'string' ? data['title'] : '',
        createdAt: readCreatedAt(data),
      };
    });

    const userIds = Array.from(new Set(rows.map((row) => row.userId).filter(Boolean)));
    const userDocs =
      userIds.length > 0
        ? await adminDb.getAll(
            ...userIds.map((uid) => adminDb.collection(COLLECTIONS.USERS).doc(uid)),
            { fieldMask: ['name'] },
          )
        : [];
    const namesById = new Map<string, string>();
    userDocs.forEach((doc) => {
      if (doc.exists) {
        namesById.set(doc.id, (doc.data() as Pick<SurakshakUser, 'name'>).name);
      }
    });

    const summaries: NewIncidentSummary[] = [];
    for (const row of rows) {
      if (row.createdAt === null) continue;
      summaries.push({
        id: row.id,
        title: row.title,
        reporterName: namesById.get(row.userId) ?? null,
        createdAt: row.createdAt,
      });
    }

    // Rows are newest-first, so the first one holds the next cursor.
    const response: LatestIncidentsResponse = {
      incidents: summaries,
      cursor: summaries[0]?.createdAt ?? since,
    };
    return apiOk(response);
  } catch (error) {
    console.error('GET /api/incidents/latest failed:', error);
    return apiError('Failed to check for new incidents', 500);
  }
}
