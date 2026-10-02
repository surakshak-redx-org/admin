import type { LogContext, LogEntry, LogErrorDetails, LogLevel } from '@/types/observability.types';

const SERVICE_NAME = 'surakshak-admin';
const UNKNOWN_ENVIRONMENT = 'unknown';
const LOG_LEVEL_DEBUG: LogLevel = 'debug';
const LOG_LEVEL_INFO: LogLevel = 'info';
const LOG_LEVEL_WARN: LogLevel = 'warn';
const LOG_LEVEL_ERROR: LogLevel = 'error';

const DEFAULT_ERROR_NAME = 'Error';
const UNKNOWN_ERROR_NAME = 'UnknownError';
const UNKNOWN_ERROR_MESSAGE = 'An unknown error occurred';
const SERIALIZATION_ERROR_NAME = 'SerializationError';
const SERIALIZATION_ERROR_MESSAGE = 'Failed to serialize log entry';
const FATAL_FALLBACK_PREFIX = '{"timestamp":"';
const FATAL_FALLBACK_SUFFIX =
  '","level":"error","message":"Fatal log serialization error","service":"surakshak-admin","environment":"';

const NEWLINE = '\n';
const CONSOLE_METHOD_INFO = 'info';
const CONSOLE_METHOD_LOG = 'log';

const RESERVED_CONTEXT_KEYS: ReadonlySet<string> = new Set([
  'requestId',
  'adminUid',
  'path',
  'method',
  'statusCode',
  'durationMs',
  'error',
  'metadata',
]);

// Read process.env directly rather than importing @/config/env: that module throws on
// load when validation fails, and the error boundaries that use this logger must
// still render in that case. NEXT_PUBLIC_APP_ENV is referenced literally so Next.js
// inlines it into the client bundle.
const ENVIRONMENT: string =
  process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV ?? UNKNOWN_ENVIRONMENT;

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return UNKNOWN_ERROR_MESSAGE;
  }
}

function formatErrorDetails(err: unknown): LogErrorDetails | undefined {
  if (err === null || err === undefined) {
    return undefined;
  }

  try {
    if (err instanceof Error) {
      const details: LogErrorDetails = {
        name: err.name || DEFAULT_ERROR_NAME,
        message: err.message || UNKNOWN_ERROR_MESSAGE,
      };
      if (typeof err.stack === 'string') {
        details.stack = err.stack;
      }
      return details;
    }

    if (typeof err === 'string') {
      return {
        name: DEFAULT_ERROR_NAME,
        message: err,
      };
    }

    if (typeof err === 'object') {
      const errObj = err as Record<string, unknown>;
      const name = typeof errObj.name === 'string' ? errObj.name : DEFAULT_ERROR_NAME;
      const message = typeof errObj.message === 'string' ? errObj.message : safeStringify(errObj);
      const details: LogErrorDetails = {
        name,
        message,
      };
      if (typeof errObj.stack === 'string') {
        details.stack = errObj.stack;
      }
      return details;
    }

    if (typeof err === 'number' || typeof err === 'boolean' || typeof err === 'bigint') {
      return {
        name: UNKNOWN_ERROR_NAME,
        message: err.toString(),
      };
    }

    return {
      name: UNKNOWN_ERROR_NAME,
      message: UNKNOWN_ERROR_MESSAGE,
    };
  } catch {
    return {
      name: DEFAULT_ERROR_NAME,
      message: UNKNOWN_ERROR_MESSAGE,
    };
  }
}

function buildLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext | Partial<LogEntry>,
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: SERVICE_NAME,
    environment: ENVIRONMENT,
  };

  if (!context) {
    return entry;
  }

  if (typeof context.requestId === 'string') {
    entry.requestId = context.requestId;
  }
  if (typeof context.adminUid === 'string') {
    entry.adminUid = context.adminUid;
  }
  if (typeof context.path === 'string') {
    entry.path = context.path;
  }
  if (typeof context.method === 'string') {
    entry.method = context.method;
  }
  if (typeof context.statusCode === 'number') {
    entry.statusCode = context.statusCode;
  }
  if (typeof context.durationMs === 'number') {
    entry.durationMs = context.durationMs;
  }

  if (context.error !== undefined) {
    const errorDetails = formatErrorDetails(context.error);
    if (errorDetails) {
      entry.error = errorDetails;
    }
  }

  let extraMetadata: Record<string, unknown> | undefined;
  if (context.metadata && typeof context.metadata === 'object') {
    extraMetadata = { ...context.metadata };
  }

  const rawContext = context as Record<string, unknown>;
  for (const key of Object.keys(rawContext)) {
    if (!RESERVED_CONTEXT_KEYS.has(key)) {
      if (!extraMetadata) {
        extraMetadata = {};
      }
      extraMetadata[key] = rawContext[key];
    }
  }

  if (extraMetadata && Object.keys(extraMetadata).length > 0) {
    entry.metadata = extraMetadata;
  }

  return entry;
}

function serializeLogEntry(entry: LogEntry): string {
  try {
    return JSON.stringify(entry);
  } catch (serializationErr) {
    const errorDetails = formatErrorDetails(serializationErr);
    const fallbackEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LOG_LEVEL_ERROR,
      message: SERIALIZATION_ERROR_MESSAGE,
      service: SERVICE_NAME,
      environment: ENVIRONMENT,
      error: {
        name: SERIALIZATION_ERROR_NAME,
        message: errorDetails?.message ?? UNKNOWN_ERROR_MESSAGE,
        stack: errorDetails?.stack,
      },
    };
    try {
      return JSON.stringify(fallbackEntry);
    } catch {
      return `${FATAL_FALLBACK_PREFIX}${new Date().toISOString()}${FATAL_FALLBACK_SUFFIX}${ENVIRONMENT}"}`;
    }
  }
}

function emitLog(level: LogLevel, line: string): void {
  if (level === LOG_LEVEL_ERROR) {
    console.error(line);
    return;
  }
  if (level === LOG_LEVEL_WARN) {
    console.warn(line);
    return;
  }

  if (
    typeof process !== 'undefined' &&
    process.stdout &&
    typeof process.stdout.write === 'function'
  ) {
    process.stdout.write(line + NEWLINE);
    return;
  }

  const globalConsole = console as unknown as Record<string, ((msg: string) => void) | undefined>;
  const infoFn = globalConsole[CONSOLE_METHOD_INFO] ?? globalConsole[CONSOLE_METHOD_LOG];
  if (typeof infoFn === 'function') {
    infoFn(line);
  }
}

export interface ILogger {
  debug(message: string, context?: LogContext | Partial<LogEntry>): void;
  info(message: string, context?: LogContext | Partial<LogEntry>): void;
  warn(message: string, context?: LogContext | Partial<LogEntry>): void;
  error(message: string, context?: LogContext | Partial<LogEntry>): void;
}

export class StructuredLogger implements ILogger {
  public debug(message: string, context?: LogContext | Partial<LogEntry>): void {
    this.log(LOG_LEVEL_DEBUG, message, context);
  }

  public info(message: string, context?: LogContext | Partial<LogEntry>): void {
    this.log(LOG_LEVEL_INFO, message, context);
  }

  public warn(message: string, context?: LogContext | Partial<LogEntry>): void {
    this.log(LOG_LEVEL_WARN, message, context);
  }

  public error(message: string, context?: LogContext | Partial<LogEntry>): void {
    this.log(LOG_LEVEL_ERROR, message, context);
  }

  private log(level: LogLevel, message: string, context?: LogContext | Partial<LogEntry>): void {
    try {
      const entry = buildLogEntry(level, message, context);
      const serialized = serializeLogEntry(entry);
      emitLog(level, serialized);
    } catch {
      // High-performance logger must never crash the calling application
    }
  }
}

export const logger = new StructuredLogger();
