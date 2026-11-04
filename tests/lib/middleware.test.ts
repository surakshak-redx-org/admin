import type { DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  forbiddenResponse,
  requireSuperAdmin,
  unauthorizedResponse,
  verifyAdminToken,
} from '@/lib/auth/middleware';

import {
  mockAdminAuth,
  resetFirestoreMocks,
  setCollectionDocs,
} from '../mocks/firebase-admin.mock';

interface ApiResponse<T> {
  readonly data: T | null;
  readonly error: string | null;
}

describe('Auth Middleware', () => {
  const adminUid = 'admin-user-abc';
  const token = 'valid-firebase-jwt';

  beforeEach((): void => {
    resetFirestoreMocks();
  });

  describe('verifyAdminToken', () => {
    it('returns null when Authorization header is absent', async (): Promise<void> => {
      const request = new NextRequest('http://localhost:3000/api/incidents');
      const result = await verifyAdminToken(request);
      expect(result).toBeNull();
    });

    it('returns null when Authorization header does not use Bearer scheme', async (): Promise<void> => {
      const request = new NextRequest('http://localhost:3000/api/incidents', {
        headers: {
          Authorization: 'Basic dXNlcjpwYXNz',
        },
      });
      const result = await verifyAdminToken(request);
      expect(result).toBeNull();
    });

    it('returns null when Bearer token is empty', async (): Promise<void> => {
      const request = new NextRequest('http://localhost:3000/api/incidents', {
        headers: {
          Authorization: 'Bearer ',
        },
      });
      const result = await verifyAdminToken(request);
      expect(result).toBeNull();
    });

    it('returns null when token verification throws an error', async (): Promise<void> => {
      mockAdminAuth.verifyIdToken.mockRejectedValue(new Error('Token revoked or expired'));

      const request = new NextRequest('http://localhost:3000/api/incidents', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await verifyAdminToken(request);
      expect(result).toBeNull();
    });

    it('returns null when decoded admin UID is not found in the admins collection', async (): Promise<void> => {
      mockAdminAuth.verifyIdToken.mockResolvedValue({
        uid: adminUid,
        email: 'regular-user@surakshak.in',
      } as unknown as DecodedIdToken);

      // Do NOT add admin document to 'admins' collection

      const request = new NextRequest('http://localhost:3000/api/incidents', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await verifyAdminToken(request);
      expect(result).toBeNull();
    });

    it('returns uid and admin record when token and admin document are valid', async (): Promise<void> => {
      mockAdminAuth.verifyIdToken.mockResolvedValue({
        uid: adminUid,
        email: 'superadmin@surakshak.in',
      } as unknown as DecodedIdToken);

      setCollectionDocs('admins', [
        {
          id: adminUid,
          data: {
            uid: adminUid,
            email: 'superadmin@surakshak.in',
            displayName: 'Super Admin',
            role: 'super_admin',
            isActive: true,
          },
        },
      ]);

      const request = new NextRequest('http://localhost:3000/api/incidents', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await verifyAdminToken(request);

      expect(result).not.toBeNull();
      expect(result?.uid).toBe(adminUid);
      expect(result?.admin.email).toBe('superadmin@surakshak.in');
      expect(result?.admin.role).toBe('super_admin');
    });
  });

  describe('role handling', () => {
    function authorizedRequest(): NextRequest {
      return new NextRequest('http://localhost:3000/api/admins', {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    function setAdminDoc(data: Record<string, unknown>): void {
      mockAdminAuth.verifyIdToken.mockResolvedValue({
        uid: adminUid,
        email: 'admin@surakshak.in',
      } as unknown as DecodedIdToken);
      setCollectionDocs('admins', [{ id: adminUid, data }]);
    }

    it('treats a missing or unknown role as a standard admin', async (): Promise<void> => {
      setAdminDoc({ uid: adminUid });
      expect((await verifyAdminToken(authorizedRequest()))?.admin.role).toBe('admin');

      setAdminDoc({ uid: adminUid, role: 'owner' });
      expect((await verifyAdminToken(authorizedRequest()))?.admin.role).toBe('admin');
    });

    it('takes the uid from the verified token, not from the document', async (): Promise<void> => {
      setAdminDoc({ uid: 'someone-else', role: 'admin' });

      const result = await verifyAdminToken(authorizedRequest());

      expect(result?.uid).toBe(adminUid);
      expect(result?.admin.uid).toBe(adminUid);
    });

    it('requireSuperAdmin returns 401 when the caller is not an admin at all', async (): Promise<void> => {
      mockAdminAuth.verifyIdToken.mockResolvedValue({
        uid: adminUid,
      } as unknown as DecodedIdToken);

      const result = await requireSuperAdmin(authorizedRequest());

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(401);
    });

    it('requireSuperAdmin returns 403 for a standard admin', async (): Promise<void> => {
      setAdminDoc({ uid: adminUid, role: 'admin' });

      const result = await requireSuperAdmin(authorizedRequest());

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(403);
    });

    it('requireSuperAdmin returns the session for a super_admin', async (): Promise<void> => {
      setAdminDoc({ uid: adminUid, role: 'super_admin' });

      const result = await requireSuperAdmin(authorizedRequest());

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.session.uid).toBe(adminUid);
    });
  });

  describe('unauthorizedResponse', () => {
    it('returns a 401 JSON response with error message', async (): Promise<void> => {
      const response = unauthorizedResponse();
      expect(response.status).toBe(401);

      const json = (await response.json()) as ApiResponse<null>;
      expect(json.data).toBeNull();
      expect(json.error).toBe('Unauthorized');
    });
  });

  describe('forbiddenResponse', () => {
    it('returns a 403 JSON response with error message', async (): Promise<void> => {
      const response = forbiddenResponse();
      expect(response.status).toBe(403);

      const json = (await response.json()) as ApiResponse<null>;
      expect(json.data).toBeNull();
      expect(json.error).toBe('Forbidden');
    });
  });
});
