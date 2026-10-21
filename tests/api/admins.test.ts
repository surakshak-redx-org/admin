import type { DecodedIdToken, UserRecord } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { DELETE } from '@/app/api/admins/[uid]/route';
import { GET, POST } from '@/app/api/admins/route';
import { ADMIN_ROLES, COLLECTIONS } from '@/constants/firestore';

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

interface AdminRow {
  readonly uid: string;
  readonly role: string;
}

const CALLER_UID = 'caller-uid';
const OTHER_UID = 'other-uid';
const OTHER_EMAIL = 'other@surakshak.in';

function setCaller(role: string | undefined): void {
  mockAdminAuth.verifyIdToken.mockResolvedValue({
    uid: CALLER_UID,
    email: 'caller@surakshak.in',
  } as unknown as DecodedIdToken);
  setCollectionDocs(COLLECTIONS.ADMINS, [
    {
      id: CALLER_UID,
      data: role === undefined ? { uid: CALLER_UID } : { uid: CALLER_UID, role },
    },
  ]);
}

function jsonRequest(method: string, body?: unknown, withAuth: boolean = true): NextRequest {
  return new NextRequest('http://localhost:3000/api/admins', {
    method,
    headers: withAuth ? { Authorization: 'Bearer token' } : {},
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function deleteRequest(uid: string, withAuth: boolean = true): Promise<Response> {
  return DELETE(jsonRequest('DELETE', undefined, withAuth), {
    params: Promise.resolve({ uid }),
  });
}

async function readAdmin(uid: string): Promise<Record<string, unknown> | undefined> {
  const snap = await mockAdminDb.collection(COLLECTIONS.ADMINS).doc(uid).get();
  return snap.data();
}

describe('/api/admins is super_admin only', () => {
  beforeEach((): void => {
    resetFirestoreMocks();
  });

  describe('GET', () => {
    it('returns 401 without a token', async (): Promise<void> => {
      const response = await GET(jsonRequest('GET', undefined, false));

      expect(response.status).toBe(401);
    });

    it('returns 403 for a standard admin', async (): Promise<void> => {
      setCaller(ADMIN_ROLES.ADMIN);

      const response = await GET(jsonRequest('GET'));

      expect(response.status).toBe(403);
    });

    it('returns 403 when the admin document has no role', async (): Promise<void> => {
      setCaller(undefined);

      const response = await GET(jsonRequest('GET'));

      expect(response.status).toBe(403);
    });

    it('returns 403 for an unknown role value', async (): Promise<void> => {
      setCaller('owner');

      const response = await GET(jsonRequest('GET'));

      expect(response.status).toBe(403);
    });

    it('lists admins for a super_admin', async (): Promise<void> => {
      setCaller(ADMIN_ROLES.SUPER_ADMIN);

      const response = await GET(jsonRequest('GET'));
      const json = (await response.json()) as ApiResponse<AdminRow[]>;

      expect(response.status).toBe(200);
      expect(json.data?.map((row) => row.uid)).toEqual([CALLER_UID]);
    });
  });

  describe('POST', () => {
    it('returns 401 without a token', async (): Promise<void> => {
      const response = await POST(jsonRequest('POST', { email: OTHER_EMAIL }, false));

      expect(response.status).toBe(401);
    });

    it('returns 403 for a standard admin and creates nothing', async (): Promise<void> => {
      setCaller(ADMIN_ROLES.ADMIN);

      const response = await POST(jsonRequest('POST', { email: OTHER_EMAIL }));

      expect(response.status).toBe(403);
      expect(mockAdminAuth.getUserByEmail).not.toHaveBeenCalled();
      expect(await readAdmin(OTHER_UID)).toBeUndefined();
    });

    it('returns 400 when the email is missing or not a string', async (): Promise<void> => {
      setCaller(ADMIN_ROLES.SUPER_ADMIN);

      const missing = await POST(jsonRequest('POST', {}));
      const wrongType = await POST(jsonRequest('POST', { email: 42 }));
      const blank = await POST(jsonRequest('POST', { email: '   ' }));

      expect(missing.status).toBe(400);
      expect(wrongType.status).toBe(400);
      expect(blank.status).toBe(400);
    });

    it('returns 404 when no account matches the email', async (): Promise<void> => {
      setCaller(ADMIN_ROLES.SUPER_ADMIN);
      mockAdminAuth.getUserByEmail.mockRejectedValue(new Error('user-not-found'));

      const response = await POST(jsonRequest('POST', { email: OTHER_EMAIL }));

      expect(response.status).toBe(404);
    });

    it('creates a standard admin for a super_admin', async (): Promise<void> => {
      setCaller(ADMIN_ROLES.SUPER_ADMIN);
      mockAdminAuth.getUserByEmail.mockResolvedValue({
        uid: OTHER_UID,
        email: OTHER_EMAIL,
        displayName: 'Other Admin',
        photoURL: null,
      } as unknown as UserRecord);

      const response = await POST(jsonRequest('POST', { email: OTHER_EMAIL }));

      expect(response.status).toBe(201);
      expect((await readAdmin(OTHER_UID))?.['role']).toBe(ADMIN_ROLES.ADMIN);
    });

    it('refuses to overwrite an existing admin, so a super_admin is not demoted', async (): Promise<void> => {
      setCaller(ADMIN_ROLES.SUPER_ADMIN);
      setCollectionDocs(COLLECTIONS.ADMINS, [
        { id: CALLER_UID, data: { uid: CALLER_UID, role: ADMIN_ROLES.SUPER_ADMIN } },
        { id: OTHER_UID, data: { uid: OTHER_UID, role: ADMIN_ROLES.SUPER_ADMIN } },
      ]);
      mockAdminAuth.getUserByEmail.mockResolvedValue({
        uid: OTHER_UID,
        email: OTHER_EMAIL,
      } as unknown as UserRecord);

      const response = await POST(jsonRequest('POST', { email: OTHER_EMAIL }));

      expect(response.status).toBe(409);
      expect((await readAdmin(OTHER_UID))?.['role']).toBe(ADMIN_ROLES.SUPER_ADMIN);
    });
  });

  describe('DELETE /api/admins/[uid]', () => {
    it('returns 401 without a token', async (): Promise<void> => {
      const response = await deleteRequest(OTHER_UID, false);

      expect(response.status).toBe(401);
    });

    it('returns 403 for a standard admin and removes nothing', async (): Promise<void> => {
      setCaller(ADMIN_ROLES.ADMIN);
      setCollectionDocs(COLLECTIONS.ADMINS, [
        { id: CALLER_UID, data: { uid: CALLER_UID, role: ADMIN_ROLES.ADMIN } },
        { id: OTHER_UID, data: { uid: OTHER_UID, role: ADMIN_ROLES.ADMIN } },
      ]);

      const response = await deleteRequest(OTHER_UID);

      expect(response.status).toBe(403);
      expect(await readAdmin(OTHER_UID)).toBeDefined();
    });

    it('stops a super_admin from removing themselves', async (): Promise<void> => {
      setCaller(ADMIN_ROLES.SUPER_ADMIN);

      const response = await deleteRequest(CALLER_UID);

      expect(response.status).toBe(400);
      expect(await readAdmin(CALLER_UID)).toBeDefined();
    });

    it('lets a super_admin remove another admin', async (): Promise<void> => {
      setCaller(ADMIN_ROLES.SUPER_ADMIN);
      setCollectionDocs(COLLECTIONS.ADMINS, [
        { id: CALLER_UID, data: { uid: CALLER_UID, role: ADMIN_ROLES.SUPER_ADMIN } },
        { id: OTHER_UID, data: { uid: OTHER_UID, role: ADMIN_ROLES.ADMIN } },
      ]);

      const response = await deleteRequest(OTHER_UID);

      expect(response.status).toBe(200);
      expect(await readAdmin(OTHER_UID)).toBeUndefined();
    });
  });
});
