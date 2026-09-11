import { Timestamp } from 'firebase-admin/firestore';

/**
 * Firestore `Timestamp` instances don't survive `NextResponse.json()` as
 * usable client-side values (they'd arrive as a plain `{_seconds,
 * _nanoseconds}` object). Every API route that sends Firestore document data
 * to the client must run it through this first — it converts any top-level
 * `Timestamp` field to an ISO string, which the client can pass straight to
 * `new Date(...)`.
 */
export function serializeDoc<T extends object>(data: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    result[key] = value instanceof Timestamp ? value.toDate().toISOString() : value;
  }
  return result;
}
