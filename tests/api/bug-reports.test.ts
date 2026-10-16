import type { DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { PATCH } from '@/app/api/bug-reports/[id]/route';
import { GET, POST } from '@/app/api/bug-reports/route';
import { COLLECTIONS } from '@/constants/firestore';

import {
  mockAdminAuth,
  resetFirestoreMocks,
  setCollectionDocs,
} from '../mocks/firebase-admin.mock';

type ApiResponse<T> = { data: T | null; error: string | null };

describe('bug report API', () => {
  beforeEach(() => {
    resetFirestoreMocks();
    mockAdminAuth.verifyIdToken.mockResolvedValue({ uid: 'uid-from-token' } as DecodedIdToken);
    setCollectionDocs('admins', [
      { id: 'uid-from-token', data: { uid: 'uid-from-token', role: 'admin' } },
    ]);
  });

  it('rejects submissions without a Firebase ID token', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/bug-reports', { method: 'POST', body: '{}' }),
    );
    expect(response.status).toBe(401);
  });

  it('validates the payload and derives reporter identity from the verified token', async () => {
    const request = new NextRequest('http://localhost/api/bug-reports', {
      method: 'POST',
      headers: { Authorization: 'Bearer user-token' },
      body: JSON.stringify({
        title: 'App freezes',
        description: 'The app freezes after login.',
        category: 'crash',
        severity: 'high',
        platform: 'android',
        appVersion: '1.3.0',
        userId: 'forged-user',
      }),
    });
    const response = await POST(request);
    const body = (await response.json()) as ApiResponse<{ id: string }>;
    expect(response.status).toBe(400);
    expect(body.data).toBeNull();
  });

  it('stores valid reports in the dedicated collection with server-owned identity and status', async () => {
    const request = new NextRequest('http://localhost/api/bug-reports', {
      method: 'POST',
      headers: { Authorization: 'Bearer user-token' },
      body: JSON.stringify({
        title: 'App freezes',
        description: 'The app freezes after login.',
        category: 'crash',
        severity: 'high',
        platform: 'android',
        appVersion: '1.3.0',
      }),
    });
    const response = await POST(request);
    const body = (await response.json()) as ApiResponse<{ id: string }>;
    expect(response.status).toBe(201);
    expect(body.data?.id).toBeTruthy();
    const list = await GET(
      new NextRequest('http://localhost/api/bug-reports', {
        headers: { Authorization: 'Bearer admin-token' },
      }),
    );
    const result = (await list.json()) as ApiResponse<{ reports: Array<Record<string, unknown>> }>;
    expect(result.data?.reports[0]).toMatchObject({
      userId: 'uid-from-token',
      status: 'open',
      title: 'App freezes',
      category: 'crash',
    });
    expect(COLLECTIONS.BUG_REPORTS).toBe('bugReports');
  });

  it('filters reports by status, category, severity, and text search', async () => {
    setCollectionDocs(COLLECTIONS.BUG_REPORTS, [
      {
        id: 'match',
        data: {
          title: 'Map crashes',
          description: 'The map closes on open',
          status: 'open',
          category: 'crash',
          severity: 'high',
          userId: 'u1',
          createdAt: new Date(),
        },
      },
      {
        id: 'other',
        data: {
          title: 'Login slow',
          description: 'Slow sign in',
          status: 'resolved',
          category: 'performance',
          severity: 'low',
          userId: 'u2',
          createdAt: new Date(),
        },
      },
    ]);
    const response = await GET(
      new NextRequest(
        'http://localhost/api/bug-reports?status=open&category=crash&severity=high&q=map',
        { headers: { Authorization: 'Bearer admin-token' } },
      ),
    );
    const body = (await response.json()) as ApiResponse<{ reports: Array<{ id: string }> }>;
    expect(response.status).toBe(200);
    expect(body.data?.reports.map((report) => report.id)).toEqual(['match']);
  });

  it('requires an admin identity to list reports and returns 404 for missing update targets', async () => {
    setCollectionDocs('admins', []);
    const forbidden = await GET(
      new NextRequest('http://localhost/api/bug-reports', {
        headers: { Authorization: 'Bearer user-token' },
      }),
    );
    expect(forbidden.status).toBe(401);
    setCollectionDocs('admins', [
      { id: 'uid-from-token', data: { uid: 'uid-from-token', role: 'admin' } },
    ]);
    const missing = await PATCH(
      new NextRequest('http://localhost/api/bug-reports/missing', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      }),
      { params: Promise.resolve({ id: 'missing' }) },
    );
    expect(missing.status).toBe(404);

    setCollectionDocs(COLLECTIONS.BUG_REPORTS, [
      { id: 'existing', data: { status: 'open', adminNotes: '' } },
    ]);
    const updated = await PATCH(
      new NextRequest('http://localhost/api/bug-reports/existing', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress', adminNotes: 'Investigating' }),
      }),
      { params: Promise.resolve({ id: 'existing' }) },
    );
    expect(updated.status).toBe(200);
    const updatedBody = (await updated.json()) as ApiResponse<{
      status: string;
      adminNotes: string;
    }>;
    expect(updatedBody.data).toMatchObject({ status: 'in_progress', adminNotes: 'Investigating' });
  });
});
