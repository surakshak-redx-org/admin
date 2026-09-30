import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { ENV } from '@/config/env';
import { COLLECTIONS } from '@/constants/firestore';
import { adminApp, adminDb } from '@/lib/firebase/admin';
import type {
  DependencyCheckResult,
  DependencyStatus,
  HealthCheckResult,
  HealthStatus,
  LivenessResponse,
  ReadinessResponse,
} from '@/types/observability.types';

export const dynamic = 'force-dynamic';

const APP_VERSION = '0.1.0';

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;

const CACHE_TTL_MS = 15_000;
const BYTES_PER_MB = 1024 * 1024;
const DECIMAL_PRECISION = 2;
const BASE_TEN = 10;

const HEADER_CACHE_CONTROL = 'Cache-Control';
const CACHE_CONTROL_LIVE = 'no-cache, no-store, must-revalidate';
const CACHE_CONTROL_CACHED = 'public, max-age=15';

const PARAM_DEEP = 'deep';
const VALUE_TRUE = 'true';

const CHECK_FIREBASE_ADMIN = 'firebase-admin';
const CHECK_FIRESTORE = 'firestore';
const CHECK_CONFIGURATION = 'configuration';

const STATUS_HEALTHY: DependencyStatus = 'healthy';
const STATUS_UNHEALTHY: DependencyStatus = 'unhealthy';

const OVERALL_HEALTHY: HealthStatus = 'healthy';
const OVERALL_UNHEALTHY: HealthStatus = 'unhealthy';

const LIVENESS_STATUS_OK = 'ok';

const FIRESTORE_PROBE_LIMIT = 1;

const REQUIRED_CONFIG_VARS: readonly string[] = [
  'FIREBASE_PROJECT_ID',
  'APP_ENV',
  'FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64',
  'APP_URL',
] as const;

interface CachedReadiness {
  readonly response: ReadinessResponse;
  readonly httpStatus: number;
  readonly cachedAt: number;
}

let readinessCache: CachedReadiness | null = null;

function roundToPrecision(value: number, decimals: number): number {
  const factor = Math.pow(BASE_TEN, decimals);
  return Math.round(value * factor) / factor;
}

function getSystemMetrics(): ReadinessResponse['system'] {
  const mem = process.memoryUsage();
  return {
    memory: {
      heapUsedMb: roundToPrecision(mem.heapUsed / BYTES_PER_MB, DECIMAL_PRECISION),
      heapTotalMb: roundToPrecision(mem.heapTotal / BYTES_PER_MB, DECIMAL_PRECISION),
      rssMb: roundToPrecision(mem.rss / BYTES_PER_MB, DECIMAL_PRECISION),
    },
    nodeVersion: process.version,
  };
}

function checkFirebaseAdmin(): DependencyCheckResult {
  const start = Date.now();
  try {
    if (!adminApp || typeof adminApp.name !== 'string' || adminApp.name.length === 0) {
      return {
        name: CHECK_FIREBASE_ADMIN,
        status: STATUS_UNHEALTHY,
        latencyMs: Date.now() - start,
        message: 'Firebase Admin application instance is not initialized or invalid',
      };
    }

    return {
      name: CHECK_FIREBASE_ADMIN,
      status: STATUS_HEALTHY,
      latencyMs: Date.now() - start,
      message: 'Firebase Admin initialized successfully',
      details: {
        appName: adminApp.name,
      },
    };
  } catch (error: unknown) {
    return {
      name: CHECK_FIREBASE_ADMIN,
      status: STATUS_UNHEALTHY,
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Firebase Admin health check failed',
    };
  }
}

async function checkFirestore(): Promise<DependencyCheckResult> {
  const start = Date.now();
  try {
    await adminDb.collection(COLLECTIONS.ADMINS).limit(FIRESTORE_PROBE_LIMIT).get();
    return {
      name: CHECK_FIRESTORE,
      status: STATUS_HEALTHY,
      latencyMs: Date.now() - start,
      message: 'Firestore probe query executed successfully',
    };
  } catch (error: unknown) {
    return {
      name: CHECK_FIRESTORE,
      status: STATUS_UNHEALTHY,
      latencyMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Firestore connectivity probe failed',
    };
  }
}

function checkConfiguration(): DependencyCheckResult {
  const start = Date.now();
  const missingVars: string[] = [];
  const presentVars: string[] = [];

  for (const varName of REQUIRED_CONFIG_VARS) {
    let isPresent = false;
    if (varName === 'FIREBASE_PROJECT_ID') {
      isPresent = Boolean(ENV.FIREBASE_PROJECT_ID);
    } else if (varName === 'APP_ENV') {
      isPresent = Boolean(ENV.APP_ENV);
    } else if (varName === 'APP_URL') {
      isPresent = Boolean(ENV.APP_URL);
    } else if (varName === 'FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64') {
      isPresent = Boolean(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64);
    }

    if (isPresent) {
      presentVars.push(varName);
    } else {
      missingVars.push(varName);
    }
  }

  const isHealthy = missingVars.length === 0;

  return {
    name: CHECK_CONFIGURATION,
    status: isHealthy ? STATUS_HEALTHY : STATUS_UNHEALTHY,
    latencyMs: Date.now() - start,
    message: isHealthy
      ? 'All critical configuration environment variables are present'
      : `Missing critical configuration variables: ${missingVars.join(', ')}`,
    details: {
      checkedCount: REQUIRED_CONFIG_VARS.length,
      presentCount: presentVars.length,
      missingCount: missingVars.length,
      presentVars,
      missingVars,
    },
  };
}

function buildLivenessResponse(): LivenessResponse {
  return {
    status: LIVENESS_STATUS_OK,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: ENV.APP_ENV,
    version: APP_VERSION,
  };
}

async function buildReadinessResponse(): Promise<{
  response: ReadinessResponse;
  httpStatus: number;
}> {
  const firebaseAdminCheck = checkFirebaseAdmin();
  const firestoreCheck = await checkFirestore();
  const configurationCheck = checkConfiguration();

  const checks: DependencyCheckResult[] = [firebaseAdminCheck, firestoreCheck, configurationCheck];

  const allHealthy = checks.every((check) => check.status === STATUS_HEALTHY);
  const overallStatus: HealthStatus = allHealthy ? OVERALL_HEALTHY : OVERALL_UNHEALTHY;
  const httpStatus = allHealthy ? HTTP_STATUS_OK : HTTP_STATUS_SERVICE_UNAVAILABLE;

  const response: ReadinessResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: ENV.APP_ENV,
    version: APP_VERSION,
    checks,
    system: getSystemMetrics(),
  };

  return { response, httpStatus };
}

function getValidCachedReadiness(now: number): CachedReadiness | null {
  if (readinessCache === null) {
    return null;
  }
  if (now - readinessCache.cachedAt < CACHE_TTL_MS) {
    return readinessCache;
  }
  return null;
}

export async function GET(request: NextRequest): Promise<NextResponse<HealthCheckResult>> {
  const isDeep = request.nextUrl.searchParams.get(PARAM_DEEP) === VALUE_TRUE;

  if (!isDeep) {
    const liveness = buildLivenessResponse();
    return NextResponse.json(liveness, {
      status: HTTP_STATUS_OK,
      headers: {
        [HEADER_CACHE_CONTROL]: CACHE_CONTROL_LIVE,
      },
    });
  }

  const now = Date.now();
  const cached = getValidCachedReadiness(now);
  if (cached !== null) {
    return NextResponse.json(cached.response, {
      status: cached.httpStatus,
      headers: {
        [HEADER_CACHE_CONTROL]: CACHE_CONTROL_CACHED,
      },
    });
  }

  const { response, httpStatus } = await buildReadinessResponse();

  readinessCache = {
    response,
    httpStatus,
    cachedAt: now,
  };

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      [HEADER_CACHE_CONTROL]: CACHE_CONTROL_LIVE,
    },
  });
}
