import type { Timestamp } from 'firebase-admin/firestore';

export * from './observability.types';

/**
 * API routes serialize Firestore `Timestamp` fields to ISO strings before
 * responding (see `serializeDoc`). Client components receive this shape, not
 * the raw Firestore type — use it instead of the `firestore.types.ts`
 * interfaces directly when typing API response data.
 */
export type Serialized<T> = {
  [K in keyof T]: T[K] extends Timestamp ? string : T[K];
};

/**
 * Standard successful API response payload.
 */
export interface ApiResponse<T> {
  data: T;
  error: null;
}

/**
 * Standard error API response payload with optional error details, code, and correlation ID.
 */
export interface ApiError<TDetails = Record<string, unknown>> {
  data: null;
  error: string;
  code?: string;
  details?: TDetails;
  requestId?: string;
}

/**
 * Union representing either a successful response or an error response.
 */
export type ApiResult<T> = ApiResponse<T> | ApiError;

/**
 * Additional standard API metadata for responses, pagination, and tracing.
 */
export interface ApiMetadata {
  requestId?: string;
  timestamp?: string;
  durationMs?: number;
  [key: string]: unknown;
}
