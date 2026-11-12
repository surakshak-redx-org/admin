import type { DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { GET } from '@/app/api/incidents/route';
import { COLLECTIONS } from '@/constants/firestore';

import {
  mockAdminAuth,
  resetFirestoreMocks,
  setCollectionDocs,
  setFirestoreQueryError,
} from '../mocks/firebase-admin.mock';

interface ApiResponse<T> {
  readonly data: T | null;
  readonly error: string | null;
}

interface IncidentRow {
  readonly id: string;
  readonly status: string;
  readonly createdAt: string;
}

describe('GET /api/incidents recent unresolved query', () => {
  beforeEach((): void => {
    resetFirestoreMocks();
    mockAdminAuth.verifyIdToken.mockResolvedValue({
      uid: 'admin-uid',
      email: 'admin@surakshak.in',
    } as unknown as DecodedIdToken);
    setCollectionDocs('admins', [{ id: 'admin-uid', data: { uid: 'admin-uid', role: 'admin' } }]);
  });

  function request(query = 'status=unresolved&limit=10'): NextRequest {
    return new NextRequest(`http://localhost:3000/api/incidents?${query}`, {
      headers: { Authorization: 'Bearer token' },
    });
  }

  it('filters resolved incidents before applying the bounded recent limit', async (): Promise<void> => {
    const docs = Array.from({ length: 31 }, (_, index) => ({
      id: `resolved-${index}`,
      data: {
        title: 'Resolved',
        userId: 'user-1',
        status: 'resolved',
        createdAt: new Date(Date.UTC(2026, 0, 31 - index)),
      },
    }));
    docs.push(
      ...Array.from({ length: 12 }, (_, index) => ({
        id: `open-${index}`,
        data: {
          title: 'Open',
          userId: 'user-1',
          status: index % 2 === 0 ? 'submitted' : 'under_review',
          createdAt: new Date(Date.UTC(2025, 11, 31 - index)),
        },
      })),
    );
    setCollectionDocs(COLLECTIONS.INCIDENT_REPORTS, docs);

    const response = await GET(request('status=unresolved&limit=5'));
    const json = (await response.json()) as ApiResponse<IncidentRow[]>;

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(5);
    expect(json.data?.every((incident) => incident.status !== 'resolved')).toBe(true);
    expect(json.data?.map((incident) => incident.id)).toEqual([
      'open-0',
      'open-1',
      'open-2',
      'open-3',
      'open-4',
    ]);
  });

  it('returns no rows when every incident is resolved or has no status', async (): Promise<void> => {
    setCollectionDocs(COLLECTIONS.INCIDENT_REPORTS, [
      { id: 'resolved', data: { status: 'resolved', createdAt: new Date() } },
      { id: 'legacy', data: { createdAt: new Date() } },
    ]);

    const response = await GET(request());
    const json = (await response.json()) as ApiResponse<IncidentRow[]>;

    expect(response.status).toBe(200);
    expect(json.data).toEqual([]);
  });

  it('caps a recent-results page at 25 incidents', async (): Promise<void> => {
    setCollectionDocs(COLLECTIONS.INCIDENT_REPORTS, [
      ...Array.from({ length: 30 }, (_, index) => ({
        id: `open-${index}`,
        data: {
          status: index % 2 === 0 ? 'submitted' : 'under_review',
          createdAt: new Date(Date.UTC(2026, 0, 31 - index)),
        },
      })),
    ]);

    const response = await GET(request('status=unresolved&limit=100'));
    const json = (await response.json()) as ApiResponse<IncidentRow[]>;

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(25);
    expect(json.data?.[0]?.id).toBe('open-0');
    expect(json.data?.[24]?.id).toBe('open-24');
  });

  it('rejects invalid recent limits', async (): Promise<void> => {
    const response = await GET(request('status=unresolved&limit=abc'));
    const json = (await response.json()) as ApiResponse<IncidentRow[]>;

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid limit');
  });

  it('rejects invalid limits for status-filtered requests too', async (): Promise<void> => {
    const response = await GET(request('status=rejected&limit=0'));
    const json = (await response.json()) as ApiResponse<IncidentRow[]>;

    expect(response.status).toBe(400);
    expect(json.error).toBe('Invalid limit');
  });

  it('preserves category data and supports the rejected status filter', async (): Promise<void> => {
    setCollectionDocs(COLLECTIONS.INCIDENT_REPORTS, [
      {
        id: 'rejected-1',
        data: {
          title: 'Unsafe road',
          userId: 'user-1',
          status: 'rejected',
          category: 'road_safety',
          createdAt: new Date(),
        },
      },
      {
        id: 'submitted-1',
        data: {
          title: 'Other incident',
          userId: 'user-1',
          status: 'submitted',
          createdAt: new Date(),
        },
      },
    ]);

    const response = await GET(request('status=rejected&limit=10'));
    const json = (await response.json()) as ApiResponse<(IncidentRow & { category?: string })[]>;

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data?.[0]?.id).toBe('rejected-1');
    expect(json.data?.[0]?.category).toBe('road_safety');
  });

  it('returns a safe error when Firestore fails', async (): Promise<void> => {
    setFirestoreQueryError(new Error('query failed'));

    const response = await GET(request());
    const json = (await response.json()) as ApiResponse<IncidentRow[]>;

    expect(response.status).toBe(500);
    expect(json.error).toBe('Failed to fetch incident reports');
  });
});
