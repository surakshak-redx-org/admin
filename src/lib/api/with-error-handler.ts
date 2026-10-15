import type { NextRequest, NextResponse } from 'next/server';

import { apiError } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import type { ApiResult } from '@/types/api.types';

export const HEADER_REQUEST_ID = 'x-request-id';
export const ERROR_MSG_INTERNAL_SERVER = 'Internal server error';
export const LOG_MSG_UNHANDLED_EXCEPTION = 'Unhandled API route exception';
export const STATUS_INTERNAL_SERVER_ERROR = 500;
export const DEFAULT_ERROR_NAME = 'Error';

export type ApiRouteHandler<T, TContext = unknown> = (
  request: NextRequest,
  context?: TContext,
) => Promise<NextResponse<ApiResult<T>>>;

/**
 * Centralized API route wrapper that intercepts errors, captures execution latency,
 * logs structured error payloads with logger, injects x-request-id correlation header,
 * and returns typed NextResponse<ApiResult<T>> without leaking internals.
 */
export function withApiHandler<T, TContext = unknown>(
  handler: ApiRouteHandler<T, TContext>,
): (request: NextRequest, context?: TContext) => Promise<NextResponse<ApiResult<T>>> {
  return async (request: NextRequest, context?: TContext): Promise<NextResponse<ApiResult<T>>> => {
    const startTime = Date.now();
    const requestId = request.headers.get(HEADER_REQUEST_ID) ?? crypto.randomUUID();
    const path = request.nextUrl.pathname;
    const method = request.method;

    try {
      const response = await handler(request, context);
      response.headers.set(HEADER_REQUEST_ID, requestId);
      return response;
    } catch (error: unknown) {
      const durationMs = Date.now() - startTime;

      let errorName = DEFAULT_ERROR_NAME;
      let errorMessage = ERROR_MSG_INTERNAL_SERVER;
      let errorStack: string | undefined;

      if (error instanceof Error) {
        errorName = error.name;
        errorMessage = error.message;
        errorStack = error.stack;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (typeof error === 'object' && error !== null) {
        const errObj = error as Record<string, unknown>;
        if (typeof errObj.name === 'string') {
          errorName = errObj.name;
        }
        if (typeof errObj.message === 'string') {
          errorMessage = errObj.message;
        }
        if (typeof errObj.stack === 'string') {
          errorStack = errObj.stack;
        }
      }

      logger.error(LOG_MSG_UNHANDLED_EXCEPTION, {
        requestId,
        path,
        method,
        durationMs,
        statusCode: STATUS_INTERNAL_SERVER_ERROR,
        error: {
          name: errorName,
          message: errorMessage,
          stack: errorStack,
        },
      });

      const errorResponse = apiError<T>(ERROR_MSG_INTERNAL_SERVER, STATUS_INTERNAL_SERVER_ERROR);
      errorResponse.headers.set(HEADER_REQUEST_ID, requestId);
      return errorResponse;
    }
  };
}
