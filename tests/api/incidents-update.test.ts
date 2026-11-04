import type { DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { PATCH } from '@/app/api/incidents/[id]/route';
import { COLLECTIONS } from '@/constants/firestore';

import {
  mockAdminAuth,
  mockAdminDb,
  resetFirestoreMocks,
  setCollectionDocs,
} from '../mocks/firebase-admin.mock';

const ADMIN_UID = 'admin-uid';
const INCIDENT_ID = 'incident-1';
const EXISTING_NOTE = 'Called the reporter, witness statement pending';

function patchRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000/api/incidents/${INCIDENT_ID}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function stored(): Promise<Record<string, unknown> | undefined> {
  const snap = await mockAdminDb.collection(COLLECTIONS.INCIDENT_REPORTS).doc(INCIDENT_ID).get();
  return snap.data();
}

describe('PATCH /api/incidents/[id]', (): void => {
  const context = { params: Promise.resolve({ id: INCIDENT_ID }) };

  beforeEach((): void => {
    resetFirestoreMocks();
    mockAdminAuth.verifyIdToken.mockResolvedValue({ uid: ADMIN_UID } as unknown as DecodedIdToken);
    setCollectionDocs('admins', [{ id: ADMIN_UID, data: { uid: ADMIN_UID, role: 'admin' } }]);
    setCollectionDocs(COLLECTIONS.INCIDENT_REPORTS, [
      { id: INCIDENT_ID, data: { status: 'submitted', adminNote: EXISTING_NOTE } },
    ]);
  });

  it('keeps the existing admin note on a status-only update', async (): Promise<void> => {
    const response = await PATCH(patchRequest({ status: 'under_review' }), context);

    expect(response.status).toBe(200);
    expect((await stored())?.status).toBe('under_review');
    expect((await stored())?.adminNote).toBe(EXISTING_NOTE);
  });

  it('replaces the note when a new one is sent', async (): Promise<void> => {
    await PATCH(patchRequest({ status: 'resolved', adminNote: 'Closed' }), context);

    expect((await stored())?.adminNote).toBe('Closed');
  });

  it('rejects an unknown status and changes nothing', async (): Promise<void> => {
    const response = await PATCH(patchRequest({ status: 'archived' }), context);

    expect(response.status).toBe(400);
    expect((await stored())?.status).toBe('submitted');
  });

  it('rejects a body without a status', async (): Promise<void> => {
    const response = await PATCH(patchRequest({ adminNote: 'x' }), context);

    expect(response.status).toBe(400);
    expect((await stored())?.adminNote).toBe(EXISTING_NOTE);
  });
});
