import type { DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { GET } from '@/app/api/stats/route';
import { COLLECTIONS } from '@/constants/firestore';
import type { DashboardStats } from '@/types/firestore.types';

import {
  createMockCollection,
  mockAdminAuth,
  mockAdminDb,
  resetFirestoreMocks,
  setCollectionCount,
  setCollectionDocs,
} from '../mocks/firebase-admin.mock';

interface ApiResponse<T> {
  readonly data: T | null;
  readonly error: string | null;
}

describe('GET /api/stats', () => {
  const validUid = 'test-admin-uid-123';
  const validToken = 'valid-jwt-token';

  beforeEach((): void => {
    resetFirestoreMocks();
  });

  it('returns 401 Unauthorized when Authorization header is missing', async (): Promise<void> => {
    const request = new NextRequest('http://localhost:3000/api/stats');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const json = (await response.json()) as ApiResponse<null>;
    expect(json.error).toBe('Unauthorized');
    expect(json.data).toBeNull();
  });

  it('returns 401 Unauthorized when Bearer token is invalid', async (): Promise<void> => {
    mockAdminAuth.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

    const request = new NextRequest('http://localhost:3000/api/stats', {
      headers: {
        Authorization: 'Bearer invalid-token',
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
    const json = (await response.json()) as ApiResponse<null>;
    expect(json.error).toBe('Unauthorized');
    expect(json.data).toBeNull();
  });

  it('returns 200 OK with aggregated statistics when authenticated as admin', async (): Promise<void> => {
    mockAdminAuth.verifyIdToken.mockResolvedValue({
      uid: validUid,
      email: 'admin@surakshak.in',
    } as unknown as DecodedIdToken);

    // Setup admin document
    setCollectionDocs('admins', [
      {
        id: validUid,
        data: {
          uid: validUid,
          email: 'admin@surakshak.in',
          displayName: 'Test Admin',
          role: 'admin',
        },
      },
    ]);

    // Setup collection counts
    setCollectionCount(COLLECTIONS.USERS, 50);
    setCollectionCount(COLLECTIONS.COMMUNITY, 120);
    setCollectionCount(COLLECTIONS.UNSAFE_AREAS, 8);
    setCollectionCount(COLLECTIONS.INCIDENT_REPORTS, 15);
    setCollectionCount(COLLECTIONS.LAWS, 24);
    setCollectionCount(COLLECTIONS.NEWS, 10);

    const request = new NextRequest('http://localhost:3000/api/stats', {
      headers: {
        Authorization: `Bearer ${validToken}`,
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = (await response.json()) as ApiResponse<DashboardStats>;
    expect(json.error).toBeNull();
    expect(json.data).not.toBeNull();

    expect(json.data?.totalUsers).toBe(50);
    expect(json.data?.totalPosts).toBe(120);
    expect(json.data?.pendingUnsafeAreas).toBe(8);
    expect(json.data?.openIncidents).toBe(15);
    expect(json.data?.publishedLaws).toBe(24);
    expect(json.data?.publishedNews).toBe(10);
  });

  it('returns 500 when Firestore query fails', async (): Promise<void> => {
    mockAdminAuth.verifyIdToken.mockResolvedValue({
      uid: validUid,
      email: 'admin@surakshak.in',
    } as unknown as DecodedIdToken);

    // Make admins collection query succeed for auth check
    const adminsCol = createMockCollection('admins');
    mockAdminDb.collection.mockImplementation((name: string) => {
      if (name === 'admins') {
        const docRef = adminsCol.doc(validUid);
        return {
          ...adminsCol,
          doc: (): typeof docRef => ({
            ...docRef,
            get: () =>
              Promise.resolve({
                id: validUid,
                exists: true,
                data: () => ({ uid: validUid, email: 'admin@surakshak.in', role: 'admin' }),
              }),
          }),
        };
      }
      // Trigger error on any other collection (e.g. users count)
      throw new Error('Firestore connection failure');
    });

    const request = new NextRequest('http://localhost:3000/api/stats', {
      headers: {
        Authorization: `Bearer ${validToken}`,
      },
    });

    const response = await GET(request);

    expect(response.status).toBe(500);
    const json = (await response.json()) as ApiResponse<null>;
    expect(json.error).toBe('Failed to fetch stats');
    expect(json.data).toBeNull();
  });
});
