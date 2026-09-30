import { beforeEach, vi } from 'vitest';

import {
  mockAdminApp,
  mockAdminAuth,
  mockAdminDb,
  mockAdminStorage,
  resetFirestoreMocks,
} from './mocks/firebase-admin.mock';

process.env.APP_ENV = 'dev';
process.env.NEXT_PUBLIC_APP_ENV = 'dev';
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'surakshak-test.firebaseapp.com';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'surakshak-test';
process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'surakshak-test.appspot.com';
process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '1234567890';
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = '1:1234567890:web:abcdef123456';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.FIREBASE_PROJECT_ID = 'surakshak-test';
process.env.APP_URL = 'http://localhost:3000';
process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64 = Buffer.from(
  JSON.stringify({
    project_id: 'surakshak-test',
    client_email: 'admin@surakshak-test.iam.gserviceaccount.com',
    private_key:
      '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC3\n-----END PRIVATE KEY-----\n',
  }),
).toString('base64');

vi.mock('@/lib/firebase/admin', () => ({
  adminApp: mockAdminApp,
  adminDb: mockAdminDb,
  adminAuth: mockAdminAuth,
  adminStorage: mockAdminStorage,
}));

beforeEach((): void => {
  vi.clearAllMocks();
  resetFirestoreMocks();
});
