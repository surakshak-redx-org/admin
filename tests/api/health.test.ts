import type { DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/health/route';
import { FIRESTORE_PROBE_TIMEOUT_MS } from '@/constants/config';
import type { LivenessResponse, ReadinessResponse } from '@/types/observability.types';

import {
  createMockCollection,
  mockAdminAuth,
  mockAdminDb,
  setCollectionDocs,
  setFirestoreError,
  setFirestoreQueryError,
  type MockCollectionReference,
  type MockQuery,
} from '../mocks/firebase-admin.mock';

interface ApiErrorResponse {
  readonly data: null;
  readonly error: string;
}

describe('GET /api/health', () => {
  const validAdminUid = 'health-admin-uid-123';
  const validAdminToken = 'valid-health-admin-token';

  beforeEach((): void => {
    vi.useRealTimers();
    setFirestoreError(null);
    setFirestoreQueryError(null);

    mockAdminDb.collection.mockImplementation((name: string) => createMockCollection(name));

    mockAdminAuth.verifyIdToken.mockResolvedValue({
      uid: validAdminUid,
      email: 'admin@surakshak.in',
    } as unknown as DecodedIdToken);

    setCollectionDocs('admins', [
      {
        id: validAdminUid,
        data: {
          uid: validAdminUid,
          email: 'admin@surakshak.in',
          role: 'admin',
        },
      },
    ]);
  });

  afterEach((): void => {
    vi.useRealTimers();
    mockAdminDb.collection.mockImplementation((name: string) => createMockCollection(name));
  });

  it('returns 200 OK with liveness payload and does not touch Firestore or require auth', async (): Promise<void> => {
    const request = new NextRequest('http://localhost:3000/api/health');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');

    const json = (await response.json()) as LivenessResponse;
    expect(json.status).toBe('ok');
    expect(json.environment).toBe('dev');
    expect(json.version).toBe('0.1.0');
    expect(typeof json.uptime).toBe('number');
    expect(typeof json.timestamp).toBe('string');

    expect(mockAdminDb.collection).not.toHaveBeenCalled();
    expect(mockAdminAuth.verifyIdToken).not.toHaveBeenCalled();
  });

  it('returns 401 Unauthorized on deep probe when unauthenticated', async (): Promise<void> => {
    const request = new NextRequest('http://localhost:3000/api/health?deep=true');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const json = (await response.json()) as ApiErrorResponse;
    expect(json.error).toBe('Unauthorized');
    expect(json.data).toBeNull();
  });

  it('returns 200 OK with healthy readiness payload on deep probe when authenticated as admin and Firestore is reachable', async (): Promise<void> => {
    const request = new NextRequest('http://localhost:3000/api/health?deep=true', {
      headers: {
        Authorization: `Bearer ${validAdminToken}`,
      },
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    const json = (await response.json()) as ReadinessResponse;

    expect(json.status).toBe('healthy');
    expect(json.environment).toBe('dev');
    expect(Array.isArray(json.checks)).toBe(true);
    expect(json.checks.length).toBeGreaterThan(0);

    const firestoreCheck = json.checks.find((c) => c.name === 'firestore');
    expect(firestoreCheck?.status).toBe('healthy');

    const firebaseAdminCheck = json.checks.find((c) => c.name === 'firebase-admin');
    expect(firebaseAdminCheck?.status).toBe('healthy');

    const configCheck = json.checks.find((c) => c.name === 'configuration');
    expect(configCheck?.status).toBe('healthy');
  });

  it('returns 503 Service Unavailable when Firestore probe throws an error', async (): Promise<void> => {
    // Advance timers so we do not hit any existing cached readiness
    const now = Date.now() + 60_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);

    setFirestoreQueryError(new Error('Firestore connection error'));

    const request = new NextRequest('http://localhost:3000/api/health?deep=true', {
      headers: {
        Authorization: `Bearer ${validAdminToken}`,
      },
    });
    const response = await GET(request);

    expect(response.status).toBe(503);
    const json = (await response.json()) as ReadinessResponse;

    expect(json.status).toBe('unhealthy');
    const firestoreCheck = json.checks.find((c) => c.name === 'firestore');
    expect(firestoreCheck?.status).toBe('unhealthy');
    expect(firestoreCheck?.message).toBe('Firestore connection error');
  });

  it('returns 503 Service Unavailable when Firestore probe exceeds timeout limit', async (): Promise<void> => {
    const now = Date.now() + 180_000;
    vi.useFakeTimers();
    vi.setSystemTime(now);

    // Mock collection while preserving admin doc retrieval for verifyAdminToken
    mockAdminDb.collection.mockImplementation((name: string): MockCollectionReference => {
      const col = createMockCollection(name);
      return {
        ...col,
        limit: (): MockQuery => ({
          ...col,
          get: (): Promise<never> => new Promise<never>(() => {}),
        }),
      };
    });

    const request = new NextRequest('http://localhost:3000/api/health?deep=true', {
      headers: {
        Authorization: `Bearer ${validAdminToken}`,
      },
    });

    const responsePromise = GET(request);
    await vi.advanceTimersByTimeAsync(FIRESTORE_PROBE_TIMEOUT_MS + 100);
    const response = await responsePromise;

    expect(response.status).toBe(503);
    const json = (await response.json()) as ReadinessResponse;
    expect(json.status).toBe('unhealthy');

    const firestoreCheck = json.checks.find((c) => c.name === 'firestore');
    expect(firestoreCheck?.status).toBe('unhealthy');
    expect(firestoreCheck?.message).toContain('Firestore probe timed out');
  });

  it('serves cached readiness result within the 15s TTL window for authenticated admin', async (): Promise<void> => {
    const baseTime = Date.now() + 300_000;
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    mockAdminDb.collection.mockClear();

    // First deep request: fresh probe
    const firstRequest = new NextRequest('http://localhost:3000/api/health?deep=true', {
      headers: {
        Authorization: `Bearer ${validAdminToken}`,
      },
    });
    const firstResponse = await GET(firstRequest);
    expect(firstResponse.status).toBe(200);
    expect(firstResponse.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
    const initialCallCount = mockAdminDb.collection.mock.calls.length;
    // On first request: 1 call from verifyAdminToken ('admins') + 1 call from probe ('admins') = 2 calls
    expect(initialCallCount).toBe(2);

    // Second deep request at 5 seconds: should hit cache
    // verifyAdminToken runs (1 call to 'admins'), but probe does NOT run (0 calls).
    vi.advanceTimersByTime(5_000);
    const secondRequest = new NextRequest('http://localhost:3000/api/health?deep=true', {
      headers: {
        Authorization: `Bearer ${validAdminToken}`,
      },
    });
    const secondResponse = await GET(secondRequest);
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.headers.get('Cache-Control')).toBe('private, max-age=15');
    // Only verifyAdminToken was called (+1 call), probe was not re-executed
    expect(mockAdminDb.collection.mock.calls.length).toBe(initialCallCount + 1);

    // Third deep request after 16 seconds (exceeding TTL): should re-execute probe
    // verifyAdminToken runs (+1 call) AND probe re-runs (+1 call) = +2 calls
    vi.advanceTimersByTime(11_000);
    const thirdRequest = new NextRequest('http://localhost:3000/api/health?deep=true', {
      headers: {
        Authorization: `Bearer ${validAdminToken}`,
      },
    });
    const thirdResponse = await GET(thirdRequest);
    expect(thirdResponse.status).toBe(200);
    expect(mockAdminDb.collection.mock.calls.length).toBe(initialCallCount + 3);
  });

  it('does not cache an unhealthy readiness result', async (): Promise<void> => {
    const baseTime = Date.now() + 600_000;
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    setFirestoreQueryError(new Error('Transient Firestore failure'));
    const failingRequest = new NextRequest('http://localhost:3000/api/health?deep=true', {
      headers: {
        Authorization: `Bearer ${validAdminToken}`,
      },
    });
    const failingResponse = await GET(failingRequest);
    expect(failingResponse.status).toBe(503);

    // Firestore recovers one second later; the next deep probe must re-run, not replay the 503.
    vi.advanceTimersByTime(1_000);
    setFirestoreQueryError(null);
    const recoveredRequest = new NextRequest('http://localhost:3000/api/health?deep=true', {
      headers: {
        Authorization: `Bearer ${validAdminToken}`,
      },
    });
    const recoveredResponse = await GET(recoveredRequest);
    expect(recoveredResponse.status).toBe(200);
    expect(recoveredResponse.headers.get('Cache-Control')).toBe(
      'no-cache, no-store, must-revalidate',
    );
  });

  it('reports APP_URL as missing when NEXT_PUBLIC_APP_URL is unset despite the ENV fallback', async (): Promise<void> => {
    const baseTime = Date.now() + 900_000;
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    const savedAppUrl = process.env.APP_URL;
    const savedPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    try {
      const request = new NextRequest('http://localhost:3000/api/health?deep=true', {
        headers: {
          Authorization: `Bearer ${validAdminToken}`,
        },
      });
      const response = await GET(request);

      expect(response.status).toBe(503);
      const json = (await response.json()) as ReadinessResponse;
      const configCheck = json.checks.find((c) => c.name === 'configuration');
      expect(configCheck?.status).toBe('unhealthy');
      expect(configCheck?.message).toContain('APP_URL');
    } finally {
      process.env.APP_URL = savedAppUrl;
      process.env.NEXT_PUBLIC_APP_URL = savedPublicAppUrl;
    }
  });
});
