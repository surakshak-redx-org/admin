import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ERROR_MSG_INTERNAL_SERVER,
  HEADER_REQUEST_ID,
  STATUS_INTERNAL_SERVER_ERROR,
  withApiHandler,
} from '@/lib/api/with-error-handler';
import { logger } from '@/lib/logger';
import type { ApiResult } from '@/types/api.types';

describe('withApiHandler', () => {
  let loggerErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach((): void => {
    loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation((): void => {});
  });

  it('propagates existing x-request-id header on success', async (): Promise<void> => {
    const existingRequestId = 'custom-request-id-987';
    const handler = vi.fn((): Promise<NextResponse<ApiResult<string>>> => {
      return Promise.resolve(NextResponse.json({ data: 'success', error: null }, { status: 200 }));
    });

    const wrapped = withApiHandler(handler);
    const request = new NextRequest('http://localhost:3000/api/test', {
      headers: {
        [HEADER_REQUEST_ID]: existingRequestId,
      },
    });

    const response = await wrapped(request);

    expect(response.status).toBe(200);
    expect(response.headers.get(HEADER_REQUEST_ID)).toBe(existingRequestId);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it('generates a new x-request-id when none is provided in the request', async (): Promise<void> => {
    const handler = vi.fn((): Promise<NextResponse<ApiResult<{ id: number }>>> => {
      return Promise.resolve(NextResponse.json({ data: { id: 1 }, error: null }, { status: 200 }));
    });

    const wrapped = withApiHandler(handler);
    const request = new NextRequest('http://localhost:3000/api/users');

    const response = await wrapped(request);

    expect(response.status).toBe(200);
    const generatedId = response.headers.get(HEADER_REQUEST_ID);
    expect(generatedId).not.toBeNull();
    expect(typeof generatedId).toBe('string');
    expect(generatedId?.length).toBeGreaterThan(0);
  });

  it('catches thrown Error, logs structured payload, and returns 500 response with correlation header', async (): Promise<void> => {
    const customId = 'err-trace-123';
    const handler = vi.fn((): Promise<NextResponse<ApiResult<string>>> => {
      return Promise.reject(new Error('Database disconnected unexpectedly'));
    });

    const wrapped = withApiHandler(handler);
    const request = new NextRequest('http://localhost:3000/api/failing-endpoint', {
      method: 'POST',
      headers: {
        [HEADER_REQUEST_ID]: customId,
      },
    });

    const response = await wrapped(request);

    expect(response.status).toBe(STATUS_INTERNAL_SERVER_ERROR);
    expect(response.headers.get(HEADER_REQUEST_ID)).toBe(customId);

    const json = (await response.json()) as ApiResult<string>;
    expect(json.data).toBeNull();
    expect(json.error).toBe(ERROR_MSG_INTERNAL_SERVER);

    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Unhandled API route exception',
      expect.objectContaining({
        requestId: customId,
        path: '/api/failing-endpoint',
        method: 'POST',
        statusCode: STATUS_INTERNAL_SERVER_ERROR,
        error: {
          name: 'Error',
          message: 'Database disconnected unexpectedly',
          stack: expect.any(String) as unknown as string,
        },
      }),
    );
  });

  it('handles non-Error thrown exceptions gracefully', async (): Promise<void> => {
    const handler = vi.fn((): Promise<NextResponse<ApiResult<string>>> => {
      return Promise.reject(new Error('Raw string exception'));
    });

    const wrapped = withApiHandler(handler);
    const request = new NextRequest('http://localhost:3000/api/string-error');

    const response = await wrapped(request);

    expect(response.status).toBe(STATUS_INTERNAL_SERVER_ERROR);
    const json = (await response.json()) as ApiResult<string>;
    expect(json.error).toBe(ERROR_MSG_INTERNAL_SERVER);
    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
  });
});
