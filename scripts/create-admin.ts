/**
 * Usage: npx ts-node scripts/create-admin.ts <email> [super_admin]
 *
 * GOOGLE_APPLICATION_CREDENTIALS must point at a service account JSON with
 * access to the surakshak-2869a Firebase project (see CLAUDE.md → Firebase
 * Project — this is the one project shared by every tier).
 */
import * as fs from 'fs';
import * as path from 'path';

import type { ServiceAccount } from 'firebase-admin/app';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ?? path.join(__dirname, '../service-account.json');

if (getApps().length === 0) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8')) as ServiceAccount;
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();
const auth = getAuth();

async function createAdmin(email: string, role: 'admin' | 'super_admin'): Promise<void> {
  try {
    const user = await auth.getUserByEmail(email);
    await db
      .collection('admins')
      .doc(user.uid)
      .set({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName ?? email,
        photoUrl: user.photoURL ?? '',
        role,
        createdAt: FieldValue.serverTimestamp(),
      });
    console.warn(`✅ Admin created: ${email} (${role})`);
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }
}

const [email, roleArg] = process.argv.slice(2);
if (!email) {
  console.error('Usage: ts-node scripts/create-admin.ts <email> [super_admin]');
  process.exit(1);
}

void createAdmin(email, roleArg === 'super_admin' ? 'super_admin' : 'admin');
