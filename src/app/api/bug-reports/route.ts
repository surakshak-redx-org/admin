import {
  FieldValue,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

import { COLLECTIONS } from '@/constants/firestore';
import { apiError, apiOk } from '@/lib/api/response';
import { verifyAdminToken } from '@/lib/auth/middleware';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { serializeDoc } from '@/lib/firebase/serialize';
import type { Serialized } from '@/types/api.types';
import type {
  BugReport,
  BugReportCategory,
  BugReportSeverity,
  BugReportStatus,
} from '@/types/firestore.types';

const PAGE_MAX = 100;
const SCAN_BATCH_SIZE = 200;
const MAX_SCAN_PER_REQUEST = 1000;
const categories = ['crash', 'ui', 'login', 'performance', 'other'] as const;
const severities = ['low', 'medium', 'high', 'critical'] as const;
const statuses = ['open', 'in_progress', 'resolved', 'closed'] as const;
const submissionSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(10).max(4000),
    category: z.enum(categories),
    severity: z.enum(severities),
    stepsToReproduce: z.string().max(3000).optional().default(''),
    expectedBehavior: z.string().max(1500).optional().default(''),
    actualBehavior: z.string().max(1500).optional().default(''),
    platform: z.enum(['ios', 'android', 'web']),
    appVersion: z.string().min(1).max(64),
  })
  .strict();

export async function POST(request: NextRequest): Promise<Response> {
  const authorization = request.headers.get('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return apiError('Sign in is required', 401);

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(token)).uid;
  } catch {
    return apiError('Sign in is required', 401);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) return apiError('Invalid bug report fields', 400);

  try {
    const ref = await adminDb.collection(COLLECTIONS.BUG_REPORTS).add({
      ...parsed.data,
      userId: uid,
      status: 'open',
      adminNotes: '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return apiOk({ id: ref.id }, 201);
  } catch (error) {
    console.error('POST /api/bug-reports failed:', error);
    return apiError('Could not submit bug report', 500);
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  if (!(await verifyAdminToken(request))) return apiError('Unauthorized', 401);
  const params = request.nextUrl.searchParams;
  const rawStatus = params.get('status');
  const rawCategory = params.get('category');
  const rawSeverity = params.get('severity');
  const search = (params.get('q') ?? '').trim().toLowerCase().slice(0, 120);
  const sizeValue = Number(params.get('limit') ?? 50);
  if (!Number.isInteger(sizeValue) || sizeValue < 1) return apiError('Invalid page size', 400);
  if (rawStatus && rawStatus !== 'all' && !statuses.includes(rawStatus as BugReportStatus))
    return apiError('Invalid status filter', 400);
  if (
    rawCategory &&
    rawCategory !== 'all' &&
    !categories.includes(rawCategory as BugReportCategory)
  )
    return apiError('Invalid category filter', 400);
  if (
    rawSeverity &&
    rawSeverity !== 'all' &&
    !severities.includes(rawSeverity as BugReportSeverity)
  )
    return apiError('Invalid severity filter', 400);

  try {
    const query = adminDb.collection(COLLECTIONS.BUG_REPORTS).orderBy('createdAt', 'desc');
    const cursorId = params.get('cursor');
    let startAfter: DocumentSnapshot | undefined;
    if (cursorId) {
      const cursor = await adminDb.collection(COLLECTIONS.BUG_REPORTS).doc(cursorId).get();
      if (!cursor.exists) return apiError('Invalid page cursor', 400);
      startAfter = cursor;
    }
    const pageSize = Math.min(sizeValue, PAGE_MAX);
    const matches: QueryDocumentSnapshot[] = [];
    let lastScanned: QueryDocumentSnapshot | undefined;
    let scanned = 0;
    let exhausted = false;
    while (matches.length <= pageSize && scanned < MAX_SCAN_PER_REQUEST) {
      const batchLimit = Math.min(SCAN_BATCH_SIZE, MAX_SCAN_PER_REQUEST - scanned);
      let batchQuery = query;
      const cursor = lastScanned ?? startAfter;
      if (cursor !== undefined) batchQuery = batchQuery.startAfter(cursor);
      batchQuery = batchQuery.limit(batchLimit);
      const batch = await batchQuery.get();
      if (batch.docs.length === 0) {
        exhausted = true;
        break;
      }
      for (const doc of batch.docs) {
        lastScanned = doc;
        scanned += 1;
        const data = doc.data();
        const text =
          `${String(data.title ?? '')} ${String(data.description ?? '')} ${String(data.userId ?? '')}`.toLowerCase();
        if (
          (!rawStatus || rawStatus === 'all' || data.status === rawStatus) &&
          (!rawCategory || rawCategory === 'all' || data.category === rawCategory) &&
          (!rawSeverity || rawSeverity === 'all' || data.severity === rawSeverity) &&
          (!search || text.includes(search))
        )
          matches.push(doc);
        if (matches.length > pageSize) break;
      }
      if (matches.length > pageSize) break;
      if (batch.docs.length < batchLimit) {
        exhausted = true;
        break;
      }
    }
    const hasExtra = matches.length > pageSize;
    const docs = matches.slice(0, pageSize);
    const reports = docs.map(
      (doc) => serializeDoc({ id: doc.id, ...doc.data() }) as Serialized<BugReport>,
    );
    const counts = await Promise.all(
      statuses.map(async (status) => {
        const result = await adminDb
          .collection(COLLECTIONS.BUG_REPORTS)
          .where('status', '==', status)
          .count()
          .get();
        return [status, result.data().count] as const;
      }),
    );
    const lastReturned = docs[docs.length - 1];
    const nextCursor = hasExtra
      ? (lastReturned?.id ?? null)
      : exhausted
        ? null
        : (lastScanned?.id ?? null);
    return apiOk({
      reports,
      nextCursor,
      total: (await adminDb.collection(COLLECTIONS.BUG_REPORTS).count().get()).data().count,
      counts: Object.fromEntries(counts),
    });
  } catch (error) {
    console.error('GET /api/bug-reports failed:', error);
    return apiError('Failed to fetch bug reports', 500);
  }
}
