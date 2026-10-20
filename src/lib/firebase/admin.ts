import type { App, ServiceAccount } from 'firebase-admin/app';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function getAdminApp(): App {
  if (getApps().length > 0) return getApp();

  const serviceAccountBase64 = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64;

  if (!serviceAccountBase64) {
    throw new Error(
      'FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64 is not set. See .env.example for setup instructions.',
    );
  }

  const serviceAccount = JSON.parse(
    Buffer.from(serviceAccountBase64, 'base64').toString('utf-8'),
  ) as ServiceAccount;

  return initializeApp({ credential: cert(serviceAccount) });
}

/**
 * Next.js imports route modules while collecting build-time configuration.
 * Keep Firebase initialization behind property access so those imports do not
 * require deployment credentials. The first Firebase-backed operation still
 * validates credentials and fails with the same explicit configuration error.
 */
function lazyFirebaseService<T extends object>(getService: () => T): T {
  return new Proxy({} as T, {
    get(_target, property): unknown {
      const service = getService();
      const value: unknown = Reflect.get(service, property, service);
      return typeof value === 'function' ? value.bind(service) : value;
    },
  });
}

export const adminApp = lazyFirebaseService(getAdminApp);
export const adminDb = lazyFirebaseService(() => getFirestore(getAdminApp()));
export const adminAuth = lazyFirebaseService(() => getAuth(getAdminApp()));
export const adminStorage = lazyFirebaseService(() => getStorage(getAdminApp()));
