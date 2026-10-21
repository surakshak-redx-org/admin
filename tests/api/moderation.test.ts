import type { DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { PATCH } from '@/app/api/moderation/[id]/route';
import { GET } from '@/app/api/moderation/route';
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

interface ModerationRow {
  readonly id: string;
  readonly imageUrl: string | null;
  readonly locationUrl: string | null;
  readonly authorPhotoUrl: string;
  readonly state: string;
}

const IMAGE_URL = 'https://firebasestorage.googleapis.com/v0/b/demo/o/post.jpg';

describe('GET /api/moderation', () => {
  const adminUid = 'admin-uid';

  beforeEach((): void => {
    resetFirestoreMocks();
    mockAdminAuth.verifyIdToken.mockResolvedValue({
      uid: adminUid,
      email: 'admin@surakshak.in',
    } as unknown as DecodedIdToken);
    setCollectionDocs('admins', [{ id: adminUid, data: { uid: adminUid, role: 'admin' } }]);
  });

  function request(withAuth: boolean): NextRequest {
    return new NextRequest('http://localhost:3000/api/moderation', {
      headers: withAuth ? { Authorization: 'Bearer token' } : {},
    });
  }

  it('rejects requests without an auth token', async (): Promise<void> => {
    const response = await GET(request(false));

    expect(response.status).toBe(401);
  });

  it('returns the image, location and author photo fields so the admin can preview a post', async (): Promise<void> => {
    setCollectionDocs(COLLECTIONS.COMMUNITY, [
      {
        id: 'p1',
        data: {
          isHidden: true,
          reportCount: 4,
          content: 'Unsafe',
          imageUrl: IMAGE_URL,
          locationUrl: null,
          authorPhotoUrl: '',
          state: 'Maharashtra',
        },
      },
    ]);

    const response = await GET(request(true));
    const json = (await response.json()) as ApiResponse<ModerationRow[]>;

    expect(response.status).toBe(200);
    expect(json.data?.[0]?.imageUrl).toBe(IMAGE_URL);
  });
});

describe('PATCH /api/moderation/[id]', () => {
  const adminUid = 'admin-uid';
  const adminEmail = 'admin@surakshak.in';
  const reason = 'Targets another user with abuse';

  beforeEach((): void => {
    resetFirestoreMocks();
    mockAdminAuth.verifyIdToken.mockResolvedValue({
      uid: adminUid,
      email: adminEmail,
    } as unknown as DecodedIdToken);
    setCollectionDocs('admins', [
      { id: adminUid, data: { uid: adminUid, email: adminEmail, role: 'admin' } },
    ]);
    setCollectionDocs(COLLECTIONS.COMMUNITY, [
      { id: 'p1', data: { content: 'Reported post', isHidden: true, reportCount: 5 } },
    ]);
  });

  function patchRequest(action: string, body: Record<string, unknown> = {}): NextRequest {
    return new NextRequest('http://localhost:3000/api/moderation/p1', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    });
  }

  const context = { params: Promise.resolve({ id: 'p1' }) };

  it('refuses to delete without a reason and keeps the post', async (): Promise<void> => {
    const response = await PATCH(patchRequest('delete'), context);

    expect(response.status).toBe(400);
    expect(getCollectionDocs(COLLECTIONS.COMMUNITY)).toHaveLength(1);
    expect(getCollectionDocs(COLLECTIONS.AUDIT_LOGS)).toHaveLength(0);
  });

  it('refuses a blank reason', async (): Promise<void> => {
    const response = await PATCH(patchRequest('delete', { reason: '  ' }), context);

    expect(response.status).toBe(400);
    expect(getCollectionDocs(COLLECTIONS.COMMUNITY)).toHaveLength(1);
  });

  it('deletes with a reason and writes an audit log containing the post', async (): Promise<void> => {
    const response = await PATCH(patchRequest('delete', { reason }), context);

    expect(response.status).toBe(200);
    expect(getCollectionDocs(COLLECTIONS.COMMUNITY)).toHaveLength(0);

    const logs = getCollectionDocs(COLLECTIONS.AUDIT_LOGS);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.data).toMatchObject({
      action: AUDIT_ACTIONS.DELETE_POST,
      targetId: 'p1',
      reason,
      adminUid,
      adminEmail,
      snapshot: { content: 'Reported post', reportCount: 5 },
    });
  });

  it('returns 404 when deleting a post that does not exist', async (): Promise<void> => {
    setCollectionDocs(COLLECTIONS.COMMUNITY, []);

    const response = await PATCH(patchRequest('delete', { reason }), context);

    expect(response.status).toBe(404);
    expect(getCollectionDocs(COLLECTIONS.AUDIT_LOGS)).toHaveLength(0);
  });

  it('restores a post without needing a reason', async (): Promise<void> => {
    const response = await PATCH(patchRequest('restore'), context);

    expect(response.status).toBe(200);
    expect(getCollectionDocs(COLLECTIONS.COMMUNITY)[0]?.data).toMatchObject({
      isHidden: false,
      reportCount: 0,
    });
  });
});
