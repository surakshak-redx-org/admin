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

export const adminApp = getAdminApp();
export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
export const adminStorage = getStorage(adminApp);
