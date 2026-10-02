import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { FIRESTORE_PROBE_TIMEOUT_MS } from '@/constants/config';
import { apiError } from '@/lib/api/response';
import type { verifyAdminToken as VerifyAdminToken } from '@/lib/auth/middleware';
import type {
  DependencyCheckResult,
  DependencyStatus,
  HealthStatus,
  LivenessResponse,
  ReadinessResponse,
} from '@/types/observability.types';

export const dynamic = 'force-dynamic';

const APP_VERSION = '0.1.0';

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;

const CACHE_TTL_MS = 15_000;
const BYTES_PER_MB = 1024 * 1024;
const DECIMAL_PRECISION = 2;
const BASE_TEN = 10;

const HEADER_CACHE_CONTROL = 'Cache-Control';
const CACHE_CONTROL_LIVE = 'no-cache, no-store, must-revalidate';
const CACHE_CONTROL_CACHED = 'private, max-age=15';

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

const MESSAGE_UNAUTHORIZED = 'Unauthorized';
const MESSAGE_AUTH_UNAVAILABLE = 'Service unavailable';

const FIRESTORE_PROBE_LIMIT = 1;

const REQUIRED_CONFIG_VARS: readonly string[] = [
  'FIREBASE_PROJECT_ID',
  'APP_ENV',
  'FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64',
  'APP_URL',
] as const;

// Vars whose resolved ENV value has a built-in fallback, so presence must be
// checked against the raw process.env value instead.
const RAW_ONLY_CONFIG_VARS: ReadonlySet<string> = new Set([
  'FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64',
  'APP_URL',
]);

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

async function checkFirebaseAdmin(): Promise<DependencyCheckResult> {
  const start = Date.now();
  try {
    const adminModule = await import('@/lib/firebase/admin');
    const app = adminModule.adminApp;

    if (!app || typeof app.name !== 'string' || app.name.length === 0) {
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
        appName: app.name,
      },
    };
  } catch (error: unknown) {
    return {
      name: CHECK_FIREBASE_ADMIN,
      status: STATUS_UNHEALTHY,
      latencyMs: Date.now() - start,
      message:
        error instanceof Error
          ? error.message
          : 'Firebase Admin initialization failed or missing credentials',
    };
  }
}

async function checkFirestore(): Promise<DependencyCheckResult> {
  const start = Date.now();
  try {
    const adminModule = await import('@/lib/firebase/admin');
    const firestoreModule = await import('@/constants/firestore');
    const db = adminModule.adminDb;
    const collections = firestoreModule.COLLECTIONS;

    const probePromise = db.collection(collections.ADMINS).limit(FIRESTORE_PROBE_LIMIT).get();
    // If the timeout wins the race, a late probe rejection must not surface as an
    // unhandled rejection; the race below still observes the original promise.
    void probePromise.catch((): void => undefined);

    let timerId: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject): void => {
      timerId = setTimeout((): void => {
        reject(
          new Error(`Firestore probe timed out after ${FIRESTORE_PROBE_TIMEOUT_MS.toString()}ms`),
        );
      }, FIRESTORE_PROBE_TIMEOUT_MS);
    });

    try {
      await Promise.race([probePromise, timeoutPromise]);
    } finally {
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
    }

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

async function checkConfiguration(): Promise<DependencyCheckResult> {
  const start = Date.now();
  const missingVars: string[] = [];
  const presentVars: string[] = [];

  let resolvedEnv: Record<string, unknown> | null = null;
  try {
    const envModule = await import('@/config/env');
    resolvedEnv = envModule.ENV;
  } catch {
    // Falls back to direct process.env inspection below if env schema validation threw
  }

  for (const varName of REQUIRED_CONFIG_VARS) {
    let isPresent = false;
    if (RAW_ONLY_CONFIG_VARS.has(varName)) {
      isPresent = Boolean(process.env[varName] ?? process.env[`NEXT_PUBLIC_${varName}`]);
    } else if (resolvedEnv && resolvedEnv[varName]) {
      isPresent = Boolean(resolvedEnv[varName]);
    } else {
      isPresent = Boolean(process.env[varName] ?? process.env[`NEXT_PUBLIC_${varName}`]);
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

function resolveEnvironment(): string {
  return process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV ?? 'unknown';
}

function buildLivenessResponse(): LivenessResponse {
  return {
    status: LIVENESS_STATUS_OK,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: resolveEnvironment(),
    version: APP_VERSION,
  };
}

async function buildReadinessResponse(): Promise<{
  response: ReadinessResponse;
  httpStatus: number;
}> {
  const firebaseAdminCheck = await checkFirebaseAdmin();
  const firestoreCheck = await checkFirestore();
  const configurationCheck = await checkConfiguration();

  const checks: DependencyCheckResult[] = [firebaseAdminCheck, firestoreCheck, configurationCheck];

  const allHealthy = checks.every((check) => check.status === STATUS_HEALTHY);
  const overallStatus: HealthStatus = allHealthy ? OVERALL_HEALTHY : OVERALL_UNHEALTHY;
  const httpStatus = allHealthy ? HTTP_STATUS_OK : HTTP_STATUS_SERVICE_UNAVAILABLE;

  const response: ReadinessResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: resolveEnvironment(),
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

export async function GET(request: NextRequest): Promise<Response> {
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

  // Deep diagnostic health checks inspect internal operational parameters and downstream credentials.
  // Gated behind verifyAdminToken() to protect sensitive configuration and system metrics.
  // Imported lazily so a Firebase Admin init failure cannot break the liveness path above.
  let verifyAdminToken: typeof VerifyAdminToken;
  try {
    ({ verifyAdminToken } = await import('@/lib/auth/middleware'));
  } catch {
    // Caller is unauthenticated here, so report unavailability without any detail.
    return apiError(MESSAGE_AUTH_UNAVAILABLE, HTTP_STATUS_SERVICE_UNAVAILABLE, {
      [HEADER_CACHE_CONTROL]: CACHE_CONTROL_LIVE,
    });
  }

  const session = await verifyAdminToken(request);
  if (!session) {
    return apiError(MESSAGE_UNAUTHORIZED, HTTP_STATUS_UNAUTHORIZED);
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

  // Only healthy results are cached so recovery from a transient failure is seen immediately.
  readinessCache =
    httpStatus === HTTP_STATUS_OK
      ? {
          response,
          httpStatus,
          cachedAt: now,
        }
      : null;

  return NextResponse.json(response, {
    status: httpStatus,
    headers: {
      [HEADER_CACHE_CONTROL]: CACHE_CONTROL_LIVE,
    },
  });
}
