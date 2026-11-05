import type { DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PATCH } from '@/app/api/users/[uid]/route';
import { mockAdminAuth, mockAdminDb, setCollectionDocs } from '../mocks/firebase-admin.mock';

describe('PATCH /api/users/[uid]', () => {
  const validAdminUid = 'admin-uid-1';
  const validAdminToken = 'valid-admin-token';

  beforeEach((): void => {
    vi.clearAllMocks();
    mockAdminAuth.verifyIdToken.mockResolvedValue({
      uid: validAdminUid,
      email: 'admin@surakshak.in',
    } as unknown as DecodedIdToken);
    setCollectionDocs('admins', [
      { id: validAdminUid, data: { uid: validAdminUid, email: 'admin@surakshak.in', role: 'admin' } },
    ]);
  });

  it('suspends an active user', async (): Promise<void> => {
    setCollectionDocs('users', [
      { id: 'user-1', data: { uid: 'user-1', name: 'Alice', city: 'Pune', isSuspended: false } },
    ]);

    const request = new NextRequest('http://localhost:3000/api/users/user-1', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${validAdminToken}` },
      body: JSON.stringify({ action: 'suspend' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ uid: 'user-1' }) });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { data: { isSuspended: boolean } };
    expect(json.data.isSuspended).toBe(true);

    const userDoc = await mockAdminDb.collection('users').doc('user-1').get();
    expect(userDoc.exists).toBe(true);
    expect(userDoc.data()).toMatchObject({ isSuspended: true });
  });

  it('unsuspends a suspended user', async (): Promise<void> => {
    setCollectionDocs('users', [
      { id: 'user-1', data: { uid: 'user-1', name: 'Alice', city: 'Pune', isSuspended: true } },
    ]);

    const request = new NextRequest('http://localhost:3000/api/users/user-1', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${validAdminToken}` },
      body: JSON.stringify({ action: 'unsuspend' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ uid: 'user-1' }) });

    expect(response.status).toBe(200);
    const json = (await response.json()) as { data: { isSuspended: boolean } };
    expect(json.data.isSuspended).toBe(false);

    const userDoc = await mockAdminDb.collection('users').doc('user-1').get();
    expect(userDoc.exists).toBe(true);
    expect(userDoc.data()).toMatchObject({ isSuspended: false });
  });

  it('rejects invalid actions', async (): Promise<void> => {
    setCollectionDocs('users', [
      { id: 'user-1', data: { uid: 'user-1', name: 'Alice', city: 'Pune', isSuspended: false } },
    ]);

    const request = new NextRequest('http://localhost:3000/api/users/user-1', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${validAdminToken}` },
      body: JSON.stringify({ action: 'delete' }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ uid: 'user-1' }) });
    expect(response.status).toBe(400);
  });
});
