import type { DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { GET } from '@/app/api/unsafe-areas/[id]/route';
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

interface UnsafeAreaDetail {
  readonly reporter: { readonly name: string; readonly city: string } | null;
}

describe('GET /api/unsafe-areas/[id] reporter details', () => {
  beforeEach((): void => {
    resetFirestoreMocks();
    mockAdminAuth.verifyIdToken.mockResolvedValue({
      uid: 'admin-uid',
      email: 'admin@surakshak.in',
    } as unknown as DecodedIdToken);
    setCollectionDocs('admins', [{ id: 'admin-uid', data: { uid: 'admin-uid', role: 'admin' } }]);
    setCollectionDocs(COLLECTIONS.UNSAFE_AREAS, [
      { id: 'area-1', data: { reportedBy: 'reporter-1', title: 'Dark lane' } },
    ]);
  });

  function request(): NextRequest {
    return new NextRequest('http://localhost:3000/api/unsafe-areas/area-1', {
      headers: { Authorization: 'Bearer token' },
    });
  }

  function context(): { params: Promise<{ id: string }> } {
    return { params: Promise.resolve({ id: 'area-1' }) };
  }

  it('returns the normalized reporter name and city without unrelated private fields', async (): Promise<void> => {
    setCollectionDocs(COLLECTIONS.USERS, [
      { id: 'reporter-1', data: { name: ' Asha Patil ', city: 'Pune', phone: 'private' } },
    ]);

    const response = await GET(request(), context());
    const json = (await response.json()) as ApiResponse<UnsafeAreaDetail>;

    expect(response.status).toBe(200);
    expect(json.data?.reporter).toEqual({ name: 'Asha Patil', city: 'Pune' });
    expect(JSON.stringify(json.data?.reporter)).not.toContain('private');
  });

  it('returns a null reporter when the profile has been deleted', async (): Promise<void> => {
    setCollectionDocs(COLLECTIONS.USERS, []);

    const response = await GET(request(), context());
    const json = (await response.json()) as ApiResponse<UnsafeAreaDetail>;

    expect(response.status).toBe(200);
    expect(json.data?.reporter).toBeNull();
  });

  it('uses the fallback reporter name when the profile name is blank', async (): Promise<void> => {
    setCollectionDocs(COLLECTIONS.USERS, [
      { id: 'reporter-1', data: { name: '   ', city: 'Pune' } },
    ]);

    const response = await GET(request(), context());
    const json = (await response.json()) as ApiResponse<UnsafeAreaDetail>;

    expect(response.status).toBe(200);
    expect(json.data?.reporter).toEqual({ name: 'Unknown user', city: 'Pune' });
  });

  it('rejects requests from users without an admin record', async (): Promise<void> => {
    setCollectionDocs('admins', []);

    const response = await GET(request(), context());

    expect(response.status).toBe(401);
  });
});
