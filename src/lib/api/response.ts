import { NextResponse } from 'next/server';

import type { ApiResult } from '@/types/api.types';

export function apiOk<T>(data: T, status = 200): NextResponse<ApiResult<T>> {
  return NextResponse.json({ data, error: null }, { status });
}

export function apiError(message: string, status = 400): NextResponse<ApiResult<null>> {
  return NextResponse.json({ data: null, error: message }, { status });
}
