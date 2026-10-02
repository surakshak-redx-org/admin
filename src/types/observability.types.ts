/**
 * Observability, Health Check, and Structured Logging Types
 *
 * Rock-solid TypeScript contracts for application health checks,
 * readiness/liveness probes, structured logging payloads, and API tracing context.
 */

/**
 * Overall health status of the application or an individual subsystem.
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Status of an individual external dependency (e.g., Firestore, Auth, Storage).
 */
export type DependencyStatus = 'healthy' | 'unhealthy';

/**
 * Result of checking an individual dependency.
 */
export interface DependencyCheckResult {
  /** Identifier name of the checked dependency (e.g., 'firestore', 'auth'). */
  name: string;
  /** Status of the dependency. */
  status: DependencyStatus;
  /** Execution roundtrip latency in milliseconds. */
  latencyMs: number;
  /** Human-readable explanation or status message. */
  message?: string;
  /** Additional diagnostic key-value details. */
  details?: Record<string, unknown>;
}

/**
 * Alias for DependencyCheckResult for dependency inspection.
 */
export type DependencyCheck = DependencyCheckResult;

/**
 * Liveness probe response payload (lightweight check confirming process is alive).
 */
export interface LivenessResponse {
  /** Always 'ok' when the server is alive and accepting requests. */
  status: 'ok';
  /** ISO 8601 string timestamp when the check was performed. */
  timestamp: string;
  /** Process uptime in seconds. */
  uptime: number;
  /** Deployment environment (e.g., 'production', 'staging', 'development'). */
  environment: string;
  /** Application / build version string. */
  version: string;
}

/**
 * System memory metrics in megabytes.
 */
export interface SystemMemory {
  /** Node.js heap memory used (MB). */
  heapUsedMb: number;
  /** Node.js total heap memory allocated (MB). */
  heapTotalMb: number;
  /** Resident Set Size - total memory allocated for the process (MB). */
  rssMb: number;
}

/**
 * System runtime diagnostic metrics.
 */
export interface SystemMetrics {
  /** Node.js process memory metrics. */
  memory: SystemMemory;
  /** Active Node.js runtime version. */
  nodeVersion: string;
}

/**
 * Readiness probe response payload (verifies external dependencies and readiness to serve traffic).
 */
export interface ReadinessResponse {
  /** Overall readiness status aggregating all dependency checks. */
  status: HealthStatus;
  /** ISO 8601 string timestamp when the readiness check completed. */
  timestamp: string;
  /** Process uptime in seconds. */
  uptime: number;
  /** Deployment environment (e.g., 'production', 'staging', 'development'). */
  environment: string;
  /** Application / build version string. */
  version: string;
  /** Diagnostic check results for all downstream dependencies. */
  checks: DependencyCheckResult[];
  /** Process and system runtime diagnostics. */
  system: {
    memory: {
      heapUsedMb: number;
      heapTotalMb: number;
      rssMb: number;
    };
    nodeVersion: string;
  };
}

/**
 * Union of health check probe response shapes.
 */
export type HealthCheckResult = LivenessResponse | ReadinessResponse;

/**
 * Standard log severity levels.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Serialized error object structure for structured logs and diagnostics.
 */
export interface LogErrorDetails {
  /** Error class or constructor name (e.g., 'TypeError', 'FirebaseError'). */
  name: string;
  /** Descriptive error message. */
  message: string;
  /** Stack trace if available. */
  stack?: string;
}

/**
 * Structured log entry payload emitted by logger implementations.
 */
export interface LogEntry {
  /** ISO 8601 timestamp string when the log was generated. */
  timestamp: string;
  /** Log severity level. */
  level: LogLevel;
  /** Human-readable log message. */
  message: string;
  /** Name of the reporting service or application module (e.g., 'admin-api'). */
  service: string;
  /** Deployment environment (e.g., 'production', 'development', 'test'). */
  environment: string;
  /** Unique request correlation ID if available. */
  requestId?: string;
  /** Authenticated admin user UID if available. */
  adminUid?: string;
  /** HTTP path being handled if log occurred during an HTTP request. */
  path?: string;
  /** HTTP method (GET, POST, etc.) if log occurred during an HTTP request. */
  method?: string;
  /** HTTP status code returned if log occurred at request completion. */
  statusCode?: number;
  /** Execution duration in milliseconds. */
  durationMs?: number;
  /** Error information when logging an exception. */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  /** Arbitrary structured contextual metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Contextual metadata passed to logger methods.
 */
export interface LogContext {
  /** Unique request correlation ID. */
  requestId?: string;
  /** Authenticated admin user UID. */
  adminUid?: string;
  /** HTTP path. */
  path?: string;
  /** HTTP method. */
  method?: string;
  /** HTTP status code. */
  statusCode?: number;
  /** Execution duration in milliseconds. */
  durationMs?: number;
  /** Error information (Error instance, formatted details, or unknown caught error). */
  error?: unknown;
  /** Arbitrary structured metadata. */
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Execution context attached to an incoming API request for correlation and profiling.
 */
export interface ApiContext {
  /** Unique correlation ID assigned to the incoming request. */
  requestId: string;
  /** High-resolution start time (timestamp in milliseconds, e.g., Date.now()). */
  startTime: number;
  /** Authenticated admin user UID if session is authenticated. */
  adminUid?: string;
}
