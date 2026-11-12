import type { App } from 'firebase-admin/app';
import type { DecodedIdToken, UserRecord } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import { vi } from 'vitest';

export interface MockDocumentSnapshot<T = Record<string, unknown>> {
  readonly id: string;
  readonly exists: boolean;
  data: () => T | undefined;
}

export interface MockQuerySnapshot<T = Record<string, unknown>> {
  readonly empty: boolean;
  readonly size: number;
  readonly docs: readonly MockDocumentSnapshot<T>[];
}

export interface MockAggregateResponse {
  readonly count: number;
}

export interface MockAggregateQuerySnapshot {
  data: () => MockAggregateResponse;
}

export interface MockDocumentReference {
  readonly id: string;
  get: () => Promise<MockDocumentSnapshot>;
  set: (data: Record<string, unknown>) => Promise<void>;
  update: (data: Record<string, unknown>) => Promise<void>;
  delete: () => Promise<void>;
}

export interface MockQuery {
  where: (field: string, opStr: string, value: unknown) => MockQuery;
  orderBy: (field: string, directionStr?: 'asc' | 'desc') => MockQuery;
  limit: (limitNum: number) => MockQuery;
  select: (...fields: string[]) => MockQuery;
  get: () => Promise<MockQuerySnapshot>;
  count: () => { get: () => Promise<MockAggregateQuerySnapshot> };
}

export interface MockCollectionReference extends MockQuery {
  doc: (id?: string) => MockDocumentReference;
  add: (data: Record<string, unknown>) => Promise<MockDocumentReference>;
}

let autoIdCounter = 0;
const collectionDocsStore = new Map<string, Map<string, Record<string, unknown>>>();
const collectionCountStore = new Map<string, number>();
let firestoreQueryErrorToThrow: Error | null = null;
let firestoreErrorToThrow: Error | null = null;

export function resetFirestoreMocks(): void {
  autoIdCounter = 0;
  collectionDocsStore.clear();
  collectionCountStore.clear();
  firestoreErrorToThrow = null;
  firestoreQueryErrorToThrow = null;
  mockAdminAuth.verifyIdToken.mockReset();
  mockAdminAuth.getUserByEmail.mockReset();
}

export function setFirestoreError(error: Error | null): void {
  firestoreErrorToThrow = error;
}

export function setFirestoreQueryError(error: Error | null): void {
  firestoreQueryErrorToThrow = error;
}

export function setCollectionDocs(
  collection: string,
  docs: ReadonlyArray<{ id: string; data: Record<string, unknown> }>,
): void {
  let col = collectionDocsStore.get(collection);
  if (!col) {
    col = new Map<string, Record<string, unknown>>();
    collectionDocsStore.set(collection, col);
  }
  col.clear();
  for (const doc of docs) {
    col.set(doc.id, { ...doc.data });
  }
  collectionCountStore.set(collection, docs.length);
}

export function setCollectionCount(collection: string, count: number): void {
  collectionCountStore.set(collection, count);
}

function createMockDocRef(collectionName: string, docId: string): MockDocumentReference {
  return {
    id: docId,
    get: (): Promise<MockDocumentSnapshot> => {
      if (firestoreErrorToThrow) {
        return Promise.reject(firestoreErrorToThrow);
      }
      const col = collectionDocsStore.get(collectionName);
      const data = col?.get(docId);
      if (!data) {
        return Promise.resolve({
          id: docId,
          exists: false,
          data: (): undefined => undefined,
        });
      }
      return Promise.resolve({
        id: docId,
        exists: true,
        data: (): Record<string, unknown> => ({ ...data }),
      });
    },
    set: (data: Record<string, unknown>): Promise<void> => {
      if (firestoreErrorToThrow) {
        return Promise.reject(firestoreErrorToThrow);
      }
      let col = collectionDocsStore.get(collectionName);
      if (!col) {
        col = new Map<string, Record<string, unknown>>();
        collectionDocsStore.set(collectionName, col);
      }
      col.set(docId, { ...data });
      return Promise.resolve();
    },
    update: (data: Record<string, unknown>): Promise<void> => {
      if (firestoreErrorToThrow) {
        return Promise.reject(firestoreErrorToThrow);
      }
      const col = collectionDocsStore.get(collectionName);
      const existing = col?.get(docId);
      if (existing) {
        col?.set(docId, { ...existing, ...data });
      } else {
        col?.set(docId, { ...data });
      }
      return Promise.resolve();
    },
    delete: (): Promise<void> => {
      if (firestoreErrorToThrow) {
        return Promise.reject(firestoreErrorToThrow);
      }
      collectionDocsStore.get(collectionName)?.delete(docId);
      return Promise.resolve();
    },
  };
}

function createMockQuery(collectionName: string): MockQuery {
  const filters: { field: string; op: string; value: unknown }[] = [];
  const orderings: { field: string; direction: 'asc' | 'desc' }[] = [];
  let maxResults: number | undefined;
  const query: MockQuery = {
    where: (field, op, value): MockQuery => {
      filters.push({ field, op, value });
      return query;
    },
    orderBy: (field, direction = 'asc'): MockQuery => {
      orderings.push({ field, direction });
      return query;
    },
    limit: (limitNum): MockQuery => {
      maxResults = limitNum;
      return query;
    },
    select: (): MockQuery => query,
    get: (): Promise<MockQuerySnapshot> => {
      const err = firestoreQueryErrorToThrow ?? firestoreErrorToThrow;
      if (err) {
        return Promise.reject(err);
      }
      const col = collectionDocsStore.get(collectionName);
      let entries = [...(col?.entries() ?? [])].filter(([, data]) =>
        filters.every(({ field, op, value }) => {
          const actual = data[field];
          if (op === '==') return actual === value;
          if (op === '!=') return actual !== undefined && actual !== value;
          if (op === 'in') return Array.isArray(value) && value.includes(actual);
          return true;
        }),
      );
      for (const { field, direction } of [...orderings].reverse()) {
        entries = entries.filter(([, data]) => data[field] !== undefined);
        entries.sort(([idA, a], [idB, b]) => {
          const aValue = a[field];
          const bValue = b[field];
          const comparison =
            aValue instanceof Date && bValue instanceof Date
              ? aValue.getTime() - bValue.getTime()
              : String(aValue).localeCompare(String(bValue));
          const stableComparison = comparison || idA.localeCompare(idB);
          return direction === 'desc' ? -stableComparison : stableComparison;
        });
      }
      if (maxResults !== undefined) entries = entries.slice(0, maxResults);
      const docs: MockDocumentSnapshot[] = entries.map(([id, data]) => ({
        id,
        exists: true,
        data: (): Record<string, unknown> => ({ ...data }),
      }));
      return Promise.resolve({
        empty: docs.length === 0,
        size: docs.length,
        docs,
      });
    },
    count: (): { get: () => Promise<MockAggregateQuerySnapshot> } => ({
      get: (): Promise<MockAggregateQuerySnapshot> => {
        const err = firestoreQueryErrorToThrow ?? firestoreErrorToThrow;
        if (err) {
          return Promise.reject(err);
        }
        const explicitCount = collectionCountStore.get(collectionName);
        const actualSize = collectionDocsStore.get(collectionName)?.size ?? 0;
        const count = explicitCount !== undefined ? explicitCount : actualSize;
        return Promise.resolve({
          data: (): MockAggregateResponse => ({ count }),
        });
      },
    }),
  };

  return query;
}

export function createMockCollection(collectionName: string): MockCollectionReference {
  const query = createMockQuery(collectionName);

  return {
    ...query,
    doc: (id?: string): MockDocumentReference => {
      const docId = id ?? `mock-doc-${++autoIdCounter}`;
      return createMockDocRef(collectionName, docId);
    },
    add: (data: Record<string, unknown>): Promise<MockDocumentReference> => {
      if (firestoreErrorToThrow) {
        return Promise.reject(firestoreErrorToThrow);
      }
      const docId = `mock-doc-${++autoIdCounter}`;
      let col = collectionDocsStore.get(collectionName);
      if (!col) {
        col = new Map<string, Record<string, unknown>>();
        collectionDocsStore.set(collectionName, col);
      }
      col.set(docId, { ...data });
      return Promise.resolve(createMockDocRef(collectionName, docId));
    },
  };
}

export const mockAdminDb = {
  collection: vi.fn((name: string): MockCollectionReference => createMockCollection(name)),
  /** Batched read; a trailing read-options object (e.g. `fieldMask`) is ignored. */
  getAll: vi.fn(
    (
      ...args: (MockDocumentReference | Record<string, unknown>)[]
    ): Promise<MockDocumentSnapshot[]> =>
      Promise.all(
        args
          .filter(
            (arg): arg is MockDocumentReference => 'get' in arg && typeof arg.get === 'function',
          )
          .map((ref) => ref.get()),
      ),
  ),
};

export const mockAdminAuth = {
  verifyIdToken: vi.fn<(token: string) => Promise<DecodedIdToken>>(),
  getUserByEmail: vi.fn<(email: string) => Promise<UserRecord>>(),
};

export const mockAdminApp = {
  name: '[DEFAULT]',
} as unknown as App;

export const mockAdminStorage = {
  bucket: vi.fn((): Record<string, unknown> => ({})),
};

export { Timestamp };
