import { NextResponse } from 'next/server';

import type { ApiResult } from '@/types/api.types';

export function apiOk<T>(
  data: T,
  initOrStatus: number | ResponseInit = 200,
  headers?: HeadersInit,
): NextResponse<ApiResult<T>> {
  const init: ResponseInit =
    typeof initOrStatus === 'number'
      ? { status: initOrStatus, headers }
      : { ...initOrStatus, ...(headers ? { headers } : {}) };
  return NextResponse.json({ data, error: null }, init);
}

export function apiError(
  message: string,
  initOrStatus: number | ResponseInit = 400,
  headers?: HeadersInit,
): NextResponse<ApiResult<null>> {
  const init: ResponseInit =
    typeof initOrStatus === 'number'
      ? { status: initOrStatus, headers }
      : { ...initOrStatus, ...(headers ? { headers } : {}) };
  return NextResponse.json({ data: null, error: message }, init);
}
