import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '@/lib/logger';
import type { LogEntry } from '@/types/observability.types';

describe('StructuredLogger', () => {
  let stdoutOutput: string[] = [];
  let consoleWarnOutput: string[] = [];
  let consoleErrorOutput: string[] = [];

  beforeEach((): void => {
    stdoutOutput = [];
    consoleWarnOutput = [];
    consoleErrorOutput = [];

    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown): boolean => {
      if (typeof chunk === 'string') {
        stdoutOutput.push(chunk);
      }
      return true;
    });

    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]): void => {
      consoleWarnOutput.push(args.map(String).join(' '));
    });

    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]): void => {
      consoleErrorOutput.push(args.map(String).join(' '));
    });
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('logs info level as single-line JSON to process.stdout', (): void => {
    logger.info('Test info message', {
      requestId: 'req-123',
      adminUid: 'admin-456',
      path: '/api/test',
      method: 'GET',
    });

    expect(stdoutOutput.length).toBe(1);
    const line = stdoutOutput[0]?.trim();
    expect(line).toBeDefined();

    const parsed = JSON.parse(line ?? '') as LogEntry;
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('Test info message');
    expect(parsed.service).toBe('surakshak-admin');
    expect(parsed.environment).toBe('dev');
    expect(parsed.requestId).toBe('req-123');
    expect(parsed.adminUid).toBe('admin-456');
    expect(parsed.path).toBe('/api/test');
    expect(parsed.method).toBe('GET');
    expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
  });

  it('logs debug level as single-line JSON to process.stdout', (): void => {
    logger.debug('Debug message', {
      statusCode: 200,
      durationMs: 45,
    });

    expect(stdoutOutput.length).toBe(1);
    const line = stdoutOutput[0]?.trim();
    const parsed = JSON.parse(line ?? '') as LogEntry;

    expect(parsed.level).toBe('debug');
    expect(parsed.message).toBe('Debug message');
    expect(parsed.statusCode).toBe(200);
    expect(parsed.durationMs).toBe(45);
  });

  it('logs warn level as single-line JSON to console.warn', (): void => {
    logger.warn('Warning encountered', {
      requestId: 'warn-req-789',
      metadata: { detail: 'high-latency' },
    });

    expect(consoleWarnOutput.length).toBe(1);
    const line = consoleWarnOutput[0]?.trim();
    const parsed = JSON.parse(line ?? '') as LogEntry;

    expect(parsed.level).toBe('warn');
    expect(parsed.message).toBe('Warning encountered');
    expect(parsed.requestId).toBe('warn-req-789');
    expect(parsed.metadata).toEqual({ detail: 'high-latency' });
  });

  it('logs error level as single-line JSON to console.error with formatted Error details', (): void => {
    const errorInstance = new Error('Database connection failed');
    logger.error('Critical failure', {
      requestId: 'err-req-999',
      error: errorInstance,
    });

    expect(consoleErrorOutput.length).toBe(1);
    const line = consoleErrorOutput[0]?.trim();
    const parsed = JSON.parse(line ?? '') as LogEntry;

    expect(parsed.level).toBe('error');
    expect(parsed.message).toBe('Critical failure');
    expect(parsed.requestId).toBe('err-req-999');
    expect(parsed.error?.name).toBe('Error');
    expect(parsed.error?.message).toBe('Database connection failed');
    expect(typeof parsed.error?.stack).toBe('string');
  });

  it('formats custom unreserved keys into the metadata payload', (): void => {
    logger.info('Custom metadata event', {
      customField1: 'value1',
      customField2: 42,
    });

    expect(stdoutOutput.length).toBe(1);
    const line = stdoutOutput[0]?.trim();
    const parsed = JSON.parse(line ?? '') as LogEntry;

    expect(parsed.metadata).toEqual({
      customField1: 'value1',
      customField2: 42,
    });
  });

  it('handles non-Error objects and string errors gracefully', (): void => {
    logger.error('String error event', {
      error: 'Direct string error reason',
    });

    const parsedStringErr = JSON.parse(consoleErrorOutput[0]?.trim() ?? '') as LogEntry;
    expect(parsedStringErr.error?.message).toBe('Direct string error reason');

    logger.error('Object error event', {
      error: { customCode: 'TIMEOUT_ERR', message: 'Read timed out' },
    });

    const parsedObjErr = JSON.parse(consoleErrorOutput[1]?.trim() ?? '') as LogEntry;
    expect(parsedObjErr.error?.message).toBe('Read timed out');
  });
});
