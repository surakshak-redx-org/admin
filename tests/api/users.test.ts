import type { DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { PATCH } from '@/app/api/users/[uid]/route';
import { COLLECTIONS } from '@/constants/firestore';

import {
  mockAdminAuth,
  mockAdminDb,
  resetFirestoreMocks,
  setCollectionDocs,
} from '../mocks/firebase-admin.mock';

interface ApiResponse<T> {
  readonly data: T | null;
  readonly error: string | null;
}

interface SuspensionResult {
  readonly id: string;
  readonly isSuspended: boolean;
}

const ADMIN_UID = 'admin-uid';
const USER_ID = 'user-1';

describe('PATCH /api/users/[uid]', (): void => {
  beforeEach((): void => {
    resetFirestoreMocks();
    mockAdminAuth.verifyIdToken.mockResolvedValue({
      uid: ADMIN_UID,
      email: 'admin@surakshak.in',
    } as unknown as DecodedIdToken);
    setCollectionDocs('admins', [{ id: ADMIN_UID, data: { uid: ADMIN_UID, role: 'admin' } }]);
    setCollectionDocs(COLLECTIONS.USERS, [
      { id: USER_ID, data: { name: 'Asha Patil', isSuspended: false } },
      { id: 'user-2', data: { name: 'Meera Joshi', isSuspended: true } },
    ]);
  });

  function patchRequest(uid: string, action: string, withAuth: boolean = true): NextRequest {
    return new NextRequest(`http://localhost:3000/api/users/${uid}`, {
      method: 'PATCH',
      headers: {
        ...(withAuth ? { Authorization: 'Bearer token' } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action }),
    });
  }

  async function storedIsSuspended(uid: string): Promise<boolean | undefined> {
    const snap = await mockAdminDb.collection(COLLECTIONS.USERS).doc(uid).get();
    return (snap.data() as { isSuspended?: boolean } | undefined)?.isSuspended;
  }

  it('suspends an active user', async (): Promise<void> => {
    const response = await PATCH(patchRequest(USER_ID, 'suspend'), {
      params: Promise.resolve({ uid: USER_ID }),
    });
    const json = (await response.json()) as ApiResponse<SuspensionResult>;

    expect(response.status).toBe(200);
    expect(json.data).toEqual({ id: USER_ID, isSuspended: true });
    expect(await storedIsSuspended(USER_ID)).toBe(true);
  });

  it('unsuspends a suspended user (restores access)', async (): Promise<void> => {
    const response = await PATCH(patchRequest('user-2', 'unsuspend'), {
      params: Promise.resolve({ uid: 'user-2' }),
    });
    const json = (await response.json()) as ApiResponse<SuspensionResult>;

    expect(response.status).toBe(200);
    expect(json.data).toEqual({ id: 'user-2', isSuspended: false });
    expect(await storedIsSuspended('user-2')).toBe(false);
  });

  it('returns 404 when the user does not exist', async (): Promise<void> => {
    const response = await PATCH(patchRequest('missing-user', 'unsuspend'), {
      params: Promise.resolve({ uid: 'missing-user' }),
    });
    const json = (await response.json()) as ApiResponse<unknown>;

    expect(response.status).toBe(404);
    expect(json.error).toBe('User not found');
  });

  it('rejects an unknown action and leaves the user unchanged', async (): Promise<void> => {
    const response = await PATCH(patchRequest('user-2', 'delete'), {
      params: Promise.resolve({ uid: 'user-2' }),
    });
    const json = (await response.json()) as ApiResponse<unknown>;

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid action');
    expect(await storedIsSuspended('user-2')).toBe(true);
  });

  it('returns 401 without a valid admin token', async (): Promise<void> => {
    const response = await PATCH(patchRequest('user-2', 'unsuspend', false), {
      params: Promise.resolve({ uid: 'user-2' }),
    });

    expect(response.status).toBe(401);
    expect(await storedIsSuspended('user-2')).toBe(true);
  });
});
