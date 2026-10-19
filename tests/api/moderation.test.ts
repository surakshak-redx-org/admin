import type { DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { GET } from '@/app/api/moderation/route';
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

interface ModerationRow {
  readonly id: string;
  readonly imageUrl: string | null;
  readonly locationUrl: string | null;
  readonly authorPhotoUrl: string;
  readonly state: string;
}

const IMAGE_URL = 'https://firebasestorage.googleapis.com/v0/b/demo/o/post.jpg';

describe('GET /api/moderation', () => {
  const adminUid = 'admin-uid';

  beforeEach((): void => {
    resetFirestoreMocks();
    mockAdminAuth.verifyIdToken.mockResolvedValue({
      uid: adminUid,
      email: 'admin@surakshak.in',
    } as unknown as DecodedIdToken);
    setCollectionDocs('admins', [{ id: adminUid, data: { uid: adminUid, role: 'admin' } }]);
  });

  function request(withAuth: boolean): NextRequest {
    return new NextRequest('http://localhost:3000/api/moderation', {
      headers: withAuth ? { Authorization: 'Bearer token' } : {},
    });
  }

  it('rejects requests without an auth token', async (): Promise<void> => {
    const response = await GET(request(false));

    expect(response.status).toBe(401);
  });

  it('returns the image, location and author photo fields so the admin can preview a post', async (): Promise<void> => {
    setCollectionDocs(COLLECTIONS.COMMUNITY, [
      {
        id: 'p1',
        data: {
          isHidden: true,
          reportCount: 4,
          content: 'Unsafe',
          imageUrl: IMAGE_URL,
          locationUrl: null,
          authorPhotoUrl: '',
          state: 'Maharashtra',
        },
      },
    ]);

    const response = await GET(request(true));
    const json = (await response.json()) as ApiResponse<ModerationRow[]>;

    expect(response.status).toBe(200);
    expect(json.data?.[0]?.imageUrl).toBe(IMAGE_URL);
  });
});
