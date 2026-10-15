import type { DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { PATCH } from '@/app/api/unsafe-areas/[id]/route';
import { GET } from '@/app/api/unsafe-areas/route';
import { COLLECTIONS } from '@/constants/firestore';

import {
  mockAdminAuth,
  resetFirestoreMocks,
  setCollectionDocs,
} from '../mocks/firebase-admin.mock';

interface ApiResponse<T> {
  readonly data: T | null;
  readonly error: string | null;
}

interface AreaRow {
  readonly id: string;
  readonly reportedBy: string;
  readonly reporterName: string | null;
}

describe('GET /api/unsafe-areas', () => {
  const adminUid = 'admin-uid';

  beforeEach((): void => {
    resetFirestoreMocks();
    mockAdminAuth.verifyIdToken.mockResolvedValue({
      uid: adminUid,
      email: 'admin@surakshak.in',
    } as unknown as DecodedIdToken);
    setCollectionDocs('admins', [{ id: adminUid, data: { uid: adminUid, role: 'admin' } }]);
  });

  function request(): NextRequest {
    return new NextRequest('http://localhost:3000/api/unsafe-areas', {
      headers: { Authorization: 'Bearer token' },
    });
  }

  it("attaches each reporter's name instead of leaving only the uid (BUG-020)", async (): Promise<void> => {
    setCollectionDocs(COLLECTIONS.UNSAFE_AREAS, [
      { id: 'a1', data: { title: 'Dark lane', reportedBy: 'user-1', status: 'pending' } },
      { id: 'a2', data: { title: 'Isolated stop', reportedBy: 'user-2', status: 'pending' } },
    ]);
    setCollectionDocs(COLLECTIONS.USERS, [{ id: 'user-1', data: { name: 'Asha Patil' } }]);

    const response = await GET(request());
    const json = (await response.json()) as ApiResponse<AreaRow[]>;

    expect(response.status).toBe(200);
    expect(json.data?.find((area) => area.id === 'a1')?.reporterName).toBe('Asha Patil');
    expect(json.data?.find((area) => area.id === 'a2')?.reporterName).toBeNull();
  });
});

describe('PATCH /api/unsafe-areas/[id]', () => {
  const adminUid = 'admin-uid';

  beforeEach((): void => {
    resetFirestoreMocks();
    mockAdminAuth.verifyIdToken.mockResolvedValue({
      uid: adminUid,
      email: 'admin@surakshak.in',
    } as unknown as DecodedIdToken);
    setCollectionDocs('admins', [{ id: adminUid, data: { uid: adminUid, role: 'admin' } }]);
  });

  function patchRequest(id: string, action: string): NextRequest {
    return new NextRequest(`http://localhost:3000/api/unsafe-areas/${id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
  }

  it('fails if already rejected', async (): Promise<void> => {
    setCollectionDocs(COLLECTIONS.UNSAFE_AREAS, [
      { id: 'a1', data: { status: 'rejected', pinColor: 'orange' } },
    ]);

    const response = await PATCH(patchRequest('a1', 'reject'), {
      params: Promise.resolve({ id: 'a1' }),
    });

    expect(response.status).toBe(400);
    const json = (await response.json()) as ApiResponse<unknown>;
    expect(json.error).toBe('Unsafe area is already rejected');
  });

  it('rejects a pending area and sets pinColor to orange', async (): Promise<void> => {
    setCollectionDocs(COLLECTIONS.UNSAFE_AREAS, [
      { id: 'a1', data: { status: 'pending', pinColor: 'orange' } },
    ]);

    const response = await PATCH(patchRequest('a1', 'reject'), {
      params: Promise.resolve({ id: 'a1' }),
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as ApiResponse<{ status: string }>;
    expect(json.data?.status).toBe('rejected');
  });
});
