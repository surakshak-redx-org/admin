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
let firestoreErrorToThrow: Error | null = null;

export function resetFirestoreMocks(): void {
  autoIdCounter = 0;
  collectionDocsStore.clear();
  collectionCountStore.clear();
  firestoreErrorToThrow = null;
  mockAdminAuth.verifyIdToken.mockReset();
  mockAdminAuth.getUserByEmail.mockReset();
}

export function setFirestoreError(error: Error | null): void {
  firestoreErrorToThrow = error;
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
  const query: MockQuery = {
    where: (): MockQuery => query,
    orderBy: (): MockQuery => query,
    limit: (): MockQuery => query,
    get: (): Promise<MockQuerySnapshot> => {
      if (firestoreErrorToThrow) {
        return Promise.reject(firestoreErrorToThrow);
      }
      const col = collectionDocsStore.get(collectionName);
      const docs: MockDocumentSnapshot[] = [];
      if (col) {
        for (const [id, data] of col.entries()) {
          docs.push({
            id,
            exists: true,
            data: (): Record<string, unknown> => ({ ...data }),
          });
        }
      }
      return Promise.resolve({
        empty: docs.length === 0,
        size: docs.length,
        docs,
      });
    },
    count: (): { get: () => Promise<MockAggregateQuerySnapshot> } => ({
      get: (): Promise<MockAggregateQuerySnapshot> => {
        if (firestoreErrorToThrow) {
          return Promise.reject(firestoreErrorToThrow);
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
