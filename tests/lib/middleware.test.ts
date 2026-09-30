import type { DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { forbiddenResponse, unauthorizedResponse, verifyAdminToken } from '@/lib/auth/middleware';

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
