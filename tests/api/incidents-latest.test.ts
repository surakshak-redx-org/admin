import type { DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { GET } from '@/app/api/incidents/latest/route';
import { COLLECTIONS } from '@/constants/firestore';

import {
  mockAdminAuth,
  resetFirestoreMocks,
  setCollectionDocs,
  Timestamp,
} from '../mocks/firebase-admin.mock';

interface ApiResponse<T> {
  readonly data: T | null;
  readonly error: string | null;
}

interface LatestRow {
  readonly id: string;
  readonly title: string;
  readonly reporterName: string | null;
  readonly createdAt: string;
}

interface LatestPayload {
  readonly incidents: LatestRow[];
  readonly cursor: string;
}

const CREATED_AT = new Date('2026-10-15T10:00:00.000Z');

describe('GET /api/incidents/latest', () => {
  const adminUid = 'admin-uid';

  beforeEach((): void => {
    resetFirestoreMocks();
    mockAdminAuth.verifyIdToken.mockResolvedValue({
      uid: adminUid,
      email: 'admin@surakshak.in',
    } as unknown as DecodedIdToken);
    setCollectionDocs('admins', [{ id: adminUid, data: { uid: adminUid, role: 'admin' } }]);
  });

  function request(query: string, withAuth: boolean = true): NextRequest {
    return new NextRequest(`http://localhost:3000/api/incidents/latest${query}`, {
      headers: withAuth ? { Authorization: 'Bearer token' } : {},
    });
  }

  it('rejects requests without an auth token', async (): Promise<void> => {
    const response = await GET(request('', false));

    expect(response.status).toBe(401);
  });

  it('returns only a starting cursor on the first call, never existing incidents', async (): Promise<void> => {
    setCollectionDocs(COLLECTIONS.INCIDENT_REPORTS, [
      {
        id: 'i1',
        data: { userId: 'u1', title: 'Old report', createdAt: Timestamp.fromDate(CREATED_AT) },
      },
    ]);

    const response = await GET(request(''));
    const json = (await response.json()) as ApiResponse<LatestPayload>;

    expect(response.status).toBe(200);
    expect(json.data?.incidents).toEqual([]);
    expect(json.data?.cursor).toBe(CREATED_AT.toISOString());
  });

  it('returns the title and reporter name of new incidents and advances the cursor', async (): Promise<void> => {
    setCollectionDocs(COLLECTIONS.INCIDENT_REPORTS, [
      {
        id: 'i2',
        data: { userId: 'u1', title: 'Chain snatching', createdAt: Timestamp.fromDate(CREATED_AT) },
      },
    ]);
    setCollectionDocs(COLLECTIONS.USERS, [{ id: 'u1', data: { name: 'Asha Patil' } }]);

    const response = await GET(request('?since=2026-10-15T09:00:00.000Z'));
    const json = (await response.json()) as ApiResponse<LatestPayload>;

    expect(response.status).toBe(200);
    expect(json.data?.incidents).toEqual([
      {
        id: 'i2',
        title: 'Chain snatching',
        reporterName: 'Asha Patil',
        createdAt: CREATED_AT.toISOString(),
      },
    ]);
    expect(json.data?.cursor).toBe(CREATED_AT.toISOString());
  });

  it('keeps the same cursor when nothing is new', async (): Promise<void> => {
    setCollectionDocs(COLLECTIONS.INCIDENT_REPORTS, []);
    const since = '2026-10-15T09:00:00.000Z';

    const response = await GET(request(`?since=${since}`));
    const json = (await response.json()) as ApiResponse<LatestPayload>;

    expect(json.data).toEqual({ incidents: [], cursor: since });
  });

  it('rejects an invalid since value', async (): Promise<void> => {
    const response = await GET(request('?since=not-a-date'));

    expect(response.status).toBe(400);
  });
});
