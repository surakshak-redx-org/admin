import { describe, expect, it } from 'vitest';

import nextConfig from '../../next.config';

interface HeaderRule {
  readonly source: string;
  readonly headers: ReadonlyArray<{ readonly key: string; readonly value: string }>;
}

const PROTECTED_PATHS = ['/', '/users', '/incidents', '/login', '/api/users', '/api/admins'];
const EXCLUDED_PATHS = [
  '/_next/static/chunks/app.js',
  '/_next/image',
  '/favicon.ico',
  '/api/health',
];

async function loadRules(): Promise<readonly HeaderRule[]> {
  return (await nextConfig.headers?.()) ?? [];
}

function ruleMatches(rule: HeaderRule, path: string): boolean {
  return new RegExp(`^${rule.source}$`).test(path);
}

describe('next.config security headers', () => {
  it('marks admin pages and API responses as no-store', async (): Promise<void> => {
    const rules = await loadRules();

    for (const path of PROTECTED_PATHS) {
      const rule = rules.find((candidate) => ruleMatches(candidate, path));
      const cacheControl = rule?.headers.find((header) => header.key === 'Cache-Control');

      expect(cacheControl?.value, path).toContain('no-store');
    }
  });

  it('leaves static assets and the health endpoint to their own caching', async (): Promise<void> => {
    const rules = await loadRules();

    for (const path of EXCLUDED_PATHS) {
      expect(
        rules.some((rule) => ruleMatches(rule, path)),
        path,
      ).toBe(false);
    }
  });
});
