import type { Timestamp } from 'firebase-admin/firestore';

/**
 * API routes serialize Firestore `Timestamp` fields to ISO strings before
 * responding (see `serializeDoc`). Client components receive this shape, not
 * the raw Firestore type — use it instead of the `firestore.types.ts`
 * interfaces directly when typing API response data.
 */
export type Serialized<T> = {
  [K in keyof T]: T[K] extends Timestamp ? string : T[K];
};

export interface ApiResponse<T> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: string;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;
