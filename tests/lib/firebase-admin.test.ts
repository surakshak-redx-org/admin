import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.unmock('@/lib/firebase/admin');

describe('Firebase Admin initialization', () => {
  const originalCredentials = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64;

  beforeEach((): void => {
    vi.resetModules();
    delete process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64;
  });

  afterEach((): void => {
    if (originalCredentials === undefined) {
      delete process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64;
    } else {
      process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64 = originalCredentials;
    }
  });

  it('allows the Firebase Admin module to be imported without credentials', async (): Promise<void> => {
    const adminModule = await import('@/lib/firebase/admin');

    expect(adminModule.adminDb).toBeDefined();
    expect(adminModule.adminAuth).toBeDefined();
    expect(adminModule.adminStorage).toBeDefined();
    expect(adminModule.adminApp).toBeDefined();
  });

  it('requires credentials when a Firebase Admin operation is accessed', async (): Promise<void> => {
    const { adminDb } = await import('@/lib/firebase/admin');

    expect(() => adminDb.collection('users')).toThrow(
      'FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64 is not set. See .env.example for setup instructions.',
    );
  });
});
