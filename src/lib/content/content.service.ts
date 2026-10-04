import { adminDb } from '@/lib/firebase/admin';

/**
 * Shared Firestore access for the four simple orderable content
 * collections (laws, faqs, safetyTips) — all share the same
 * `{ ..., order: number, isPublished: boolean }` shape and CRUD pattern.
 * `news` is ordered by `publishedAt` instead and has its own service.
 */

export async function listOrderedContent<T>(collection: string): Promise<(T & { id: string })[]> {
  const snap = await adminDb.collection(collection).orderBy('order', 'asc').get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as T & { id: string });
}

export async function createOrderedContent<T extends object>(
  collection: string,
  data: T,
): Promise<string> {
  const topSnap = await adminDb.collection(collection).orderBy('order', 'desc').limit(1).get();
  let maxOrder = -1;
  const topDoc = topSnap.docs[0];
  if (topDoc) {
    const topData = topDoc.data() as { order?: number };
    maxOrder = topData.order ?? -1;
  }
  const ref = await adminDb.collection(collection).add({ ...data, order: maxOrder + 1 });
  return ref.id;
}

export async function updateContent<T extends object>(
  collection: string,
  id: string,
  data: T,
): Promise<void> {
  await adminDb
    .collection(collection)
    .doc(id)
    .update(data as Record<string, unknown>);
}

export async function deleteContent(collection: string, id: string): Promise<void> {
  await adminDb.collection(collection).doc(id).delete();
}

export async function toggleContentPublished(collection: string, id: string): Promise<boolean> {
  const ref = adminDb.collection(collection).doc(id);
  const doc = await ref.get();
  const data = doc.data() as { isPublished?: boolean } | undefined;
  const next = !(data?.isPublished ?? false);
  await ref.update({ isPublished: next });
  return next;
}

/** Sets `isPublished` to a known value with a single write (no read first). */
export async function setContentPublished(
  collection: string,
  id: string,
  isPublished: boolean,
): Promise<boolean> {
  await adminDb.collection(collection).doc(id).update({ isPublished });
  return isPublished;
}

/**
 * Applies a publish PATCH: sets the target state when the body carries
 * `{ isPublished: boolean }`, otherwise falls back to a toggle (older
 * clients send no body).
 */
export async function applyPublishPatch(
  request: Request,
  collection: string,
  id: string,
): Promise<boolean> {
  const body: unknown = await request.json().catch(() => null);
  if (
    typeof body === 'object' &&
    body !== null &&
    'isPublished' in body &&
    typeof body.isPublished === 'boolean'
  ) {
    return setContentPublished(collection, id, body.isPublished);
  }
  return toggleContentPublished(collection, id);
}
