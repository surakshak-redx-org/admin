import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { INCIDENT_STATUSES } from '@/constants/config';
import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { serializeDoc } from '@/lib/firebase/serialize';
import type { Serialized } from '@/types/api.types';
import type { IncidentReport, SurakshakUser } from '@/types/firestore.types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const { id } = await context.params;
    const doc = await adminDb.collection(COLLECTIONS.INCIDENT_REPORTS).doc(id).get();
    if (!doc.exists) return apiError('Incident report not found', 404);

    const report = serializeDoc({ id: doc.id, ...doc.data() }) as Serialized<IncidentReport>;

    let user: Pick<SurakshakUser, 'name' | 'city'> | null = null;
    const userDoc = await adminDb.collection(COLLECTIONS.USERS).doc(report.userId).get();
    if (userDoc.exists) {
      const data = userDoc.data() as SurakshakUser;
      user = { name: data.name, city: data.city };
    }

    const mapUrl = `https://www.google.com/maps/place/${report.latitude},${report.longitude}`;

    return apiOk({ report, user, mapUrl });
  } catch (error) {
    console.error('GET /api/incidents/[id] failed:', error);
    return apiError('Failed to fetch incident report', 500);
  }
}

/** `adminNote` is optional on purpose: a status-only update must not touch the existing note. */
const updateIncidentSchema = z
  .object({ status: z.enum(INCIDENT_STATUSES), adminNote: z.string().optional() })
  .strict();

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const session = await verifyAdminToken(request);
  if (!session) return apiError('Unauthorized', 401);

  try {
    const { id } = await context.params;
    const parsed = updateIncidentSchema.safeParse(await request.json());
    if (!parsed.success) return apiError('Invalid incident update', 400);

    const { status, adminNote } = parsed.data;
    const update: Record<string, unknown> = { status };
    if (adminNote !== undefined) update.adminNote = adminNote;

    await adminDb.collection(COLLECTIONS.INCIDENT_REPORTS).doc(id).update(update);
    return apiOk({ id, status });
  } catch (error) {
    console.error('PATCH /api/incidents/[id] failed:', error);
    return apiError('Failed to update incident report', 500);
  }
}
