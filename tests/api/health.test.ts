import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/health/route';
import type { LivenessResponse, ReadinessResponse } from '@/types/observability.types';

import { mockAdminDb, setFirestoreError } from '../mocks/firebase-admin.mock';

describe('GET /api/health', () => {
  beforeEach((): void => {
    vi.useRealTimers();
    setFirestoreError(null);
  });

  afterEach((): void => {
    vi.useRealTimers();
  });

  it('returns 200 OK with liveness payload and does not touch Firestore', async (): Promise<void> => {
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
  });

  it('returns 200 OK with healthy readiness payload on deep probe when Firestore is reachable', async (): Promise<void> => {
    const request = new NextRequest('http://localhost:3000/api/health?deep=true');
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

    setFirestoreError(new Error('Firestore connection timeout'));

    const request = new NextRequest('http://localhost:3000/api/health?deep=true');
    const response = await GET(request);

    expect(response.status).toBe(503);
    const json = (await response.json()) as ReadinessResponse;

    expect(json.status).toBe('unhealthy');
    const firestoreCheck = json.checks.find((c) => c.name === 'firestore');
    expect(firestoreCheck?.status).toBe('unhealthy');
    expect(firestoreCheck?.message).toBe('Firestore connection timeout');
  });

  it('serves cached readiness result within the 15s TTL window', async (): Promise<void> => {
    const baseTime = Date.now() + 120_000;
    vi.useFakeTimers();
    vi.setSystemTime(baseTime);

    mockAdminDb.collection.mockClear();

    // First deep request: fresh probe
    const firstRequest = new NextRequest('http://localhost:3000/api/health?deep=true');
    const firstResponse = await GET(firstRequest);
    expect(firstResponse.status).toBe(200);
    expect(firstResponse.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
    const initialCallCount = mockAdminDb.collection.mock.calls.length;
    expect(initialCallCount).toBeGreaterThan(0);

    // Second deep request at 5 seconds: should hit cache
    vi.advanceTimersByTime(5_000);
    const secondRequest = new NextRequest('http://localhost:3000/api/health?deep=true');
    const secondResponse = await GET(secondRequest);
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.headers.get('Cache-Control')).toBe('public, max-age=15');
    expect(mockAdminDb.collection.mock.calls.length).toBe(initialCallCount);

    // Third deep request after 16 seconds (exceeding TTL): should re-execute probe
    vi.advanceTimersByTime(11_000);
    const thirdRequest = new NextRequest('http://localhost:3000/api/health?deep=true');
    const thirdResponse = await GET(thirdRequest);
    expect(thirdResponse.status).toBe(200);
    expect(mockAdminDb.collection.mock.calls.length).toBeGreaterThan(initialCallCount);
  });
});
