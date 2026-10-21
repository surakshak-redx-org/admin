import { Timestamp } from 'firebase-admin/firestore';
import type { NextRequest } from 'next/server';

import { MODERATION_REASON_MAX_LENGTH } from '@/constants/config';
import { AUDIT_ACTIONS, COLLECTIONS } from '@/constants/firestore';
import { adminDb } from '@/lib/firebase/admin';
import type { AuditLog } from '@/types/firestore.types';

export const REASON_ERROR = `Reason is required (max ${MODERATION_REASON_MAX_LENGTH} characters)`;

export interface AuditActor {
  uid: string;
  email: string;
}

/** Reads a JSON request body, returning null when it is missing or malformed. */
export async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

/** Extracts a non-empty, length-limited `reason` string from a request body, else null. */
export function parseReason(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('reason' in body)) return null;
  const { reason } = body;
  if (typeof reason !== 'string') return null;
  const trimmed = reason.trim();
  if (trimmed === '' || trimmed.length > MODERATION_REASON_MAX_LENGTH) return null;
  return trimmed;
}

function buildAuditLog(
  action: AuditLog['action'],
  targetCollection: string,
  targetId: string,
  actor: AuditActor,
  reason: string,
  snapshot: Record<string, unknown>,
): AuditLog {
  return {
    action,
    targetCollection,
    targetId,
    reason,
    adminUid: actor.uid,
    adminEmail: actor.email,
    createdAt: Timestamp.now(),
    snapshot,
  };
}

/**
 * Deletes a community post and records who deleted it, why, and a copy of the
 * post, in one atomic batch. Returns false when the post does not exist.
 */
export async function deletePostWithAudit(
  postId: string,
  actor: AuditActor,
  reason: string,
): Promise<boolean> {
  const postRef = adminDb.collection(COLLECTIONS.COMMUNITY).doc(postId);
  const snap = await postRef.get();
  if (!snap.exists) return false;

  const batch = adminDb.batch();
  batch.set(
    adminDb.collection(COLLECTIONS.AUDIT_LOGS).doc(),
    buildAuditLog(
      AUDIT_ACTIONS.DELETE_POST,
      COLLECTIONS.COMMUNITY,
      postId,
      actor,
      reason,
      snap.data() ?? {},
    ),
  );
  batch.delete(postRef);
  await batch.commit();
  return true;
}

/**
 * Marks an unsafe-area report as rejected, keeping the record. Stores the
 * rejecting admin, time and reason on the report and appends an audit log
 * entry, in one atomic batch.
 */
export async function rejectUnsafeAreaWithAudit(
  areaId: string,
  actor: AuditActor,
  reason: string,
  snapshot: Record<string, unknown>,
): Promise<void> {
  const areaRef = adminDb.collection(COLLECTIONS.UNSAFE_AREAS).doc(areaId);
  const auditLog = buildAuditLog(
    AUDIT_ACTIONS.REJECT_UNSAFE_AREA,
    COLLECTIONS.UNSAFE_AREAS,
    areaId,
    actor,
    reason,
    snapshot,
  );

  const batch = adminDb.batch();
  batch.update(areaRef, {
    status: 'rejected',
    pinColor: 'orange',
    rejectedBy: actor.uid,
    rejectedAt: auditLog.createdAt,
    rejectionReason: reason,
  });
  batch.set(adminDb.collection(COLLECTIONS.AUDIT_LOGS).doc(), auditLog);
  await batch.commit();
}
