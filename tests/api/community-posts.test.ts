import type { DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { DELETE } from '@/app/api/community-posts/[id]/route';
import { MODERATION_REASON_MAX_LENGTH } from '@/constants/config';
import { AUDIT_ACTIONS, COLLECTIONS } from '@/constants/firestore';

import {
  getCollectionDocs,
  mockAdminAuth,
  resetFirestoreMocks,
  setCollectionDocs,
} from '../mocks/firebase-admin.mock';

interface ApiResponse<T> {
  readonly data: T | null;
  readonly error: string | null;
}

const ADMIN_UID = 'admin-uid';
const ADMIN_EMAIL = 'admin@surakshak.in';
const POST_ID = 'p1';
const REASON = 'Harassment aimed at another user';

describe('DELETE /api/community-posts/[id]', () => {
  beforeEach((): void => {
    resetFirestoreMocks();
    mockAdminAuth.verifyIdToken.mockResolvedValue({
      uid: ADMIN_UID,
      email: ADMIN_EMAIL,
    } as unknown as DecodedIdToken);
    setCollectionDocs('admins', [
      { id: ADMIN_UID, data: { uid: ADMIN_UID, email: ADMIN_EMAIL, role: 'admin' } },
    ]);
    setCollectionDocs(COLLECTIONS.COMMUNITY, [
      {
        id: POST_ID,
        data: { content: 'Flagged post', authorId: 'user-1', isHidden: true, reportCount: 4 },
      },
    ]);
  });

  function deleteRequest(body?: unknown, withAuth = true): NextRequest {
    return new NextRequest(`http://localhost:3000/api/community-posts/${POST_ID}`, {
      method: 'DELETE',
      headers: {
        ...(withAuth ? { Authorization: 'Bearer token' } : {}),
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  function context(id: string = POST_ID): { params: Promise<{ id: string }> } {
    return { params: Promise.resolve({ id }) };
  }

  it('rejects requests without an auth token', async (): Promise<void> => {
    const response = await DELETE(deleteRequest({ reason: REASON }, false), context());

    expect(response.status).toBe(401);
    expect(getCollectionDocs(COLLECTIONS.COMMUNITY)).toHaveLength(1);
  });

  it('refuses to delete without a reason and keeps the post', async (): Promise<void> => {
    const response = await DELETE(deleteRequest(), context());

    expect(response.status).toBe(400);
    expect(getCollectionDocs(COLLECTIONS.COMMUNITY)).toHaveLength(1);
    expect(getCollectionDocs(COLLECTIONS.AUDIT_LOGS)).toHaveLength(0);
  });

  it('refuses a blank reason', async (): Promise<void> => {
    const response = await DELETE(deleteRequest({ reason: '   ' }), context());

    expect(response.status).toBe(400);
    expect(getCollectionDocs(COLLECTIONS.COMMUNITY)).toHaveLength(1);
  });

  it('refuses a reason longer than the limit', async (): Promise<void> => {
    const reason = 'x'.repeat(MODERATION_REASON_MAX_LENGTH + 1);
    const response = await DELETE(deleteRequest({ reason }), context());

    expect(response.status).toBe(400);
    expect(getCollectionDocs(COLLECTIONS.COMMUNITY)).toHaveLength(1);
  });

  it('returns 404 and writes no audit log for a missing post', async (): Promise<void> => {
    const response = await DELETE(deleteRequest({ reason: REASON }), context('missing'));

    expect(response.status).toBe(404);
    expect(getCollectionDocs(COLLECTIONS.AUDIT_LOGS)).toHaveLength(0);
  });

  it('deletes the post and records who, why and a copy of it', async (): Promise<void> => {
    const response = await DELETE(deleteRequest({ reason: `  ${REASON}  ` }), context());
    const json = (await response.json()) as ApiResponse<{ id: string; deleted: boolean }>;

    expect(response.status).toBe(200);
    expect(json.data).toEqual({ id: POST_ID, deleted: true });
    expect(getCollectionDocs(COLLECTIONS.COMMUNITY)).toHaveLength(0);

    const logs = getCollectionDocs(COLLECTIONS.AUDIT_LOGS);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.data).toMatchObject({
      action: AUDIT_ACTIONS.DELETE_POST,
      targetCollection: COLLECTIONS.COMMUNITY,
      targetId: POST_ID,
      reason: REASON,
      adminUid: ADMIN_UID,
      adminEmail: ADMIN_EMAIL,
      snapshot: { content: 'Flagged post', authorId: 'user-1', reportCount: 4 },
    });
  });
});
