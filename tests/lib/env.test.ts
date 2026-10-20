import { describe, expect, it } from 'vitest';

import { getEnv } from '@/config/env';

describe('client environment validation', () => {
  it('reports missing Firebase client configuration when Firebase is initialized', (): void => {
    const originalApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

    try {
      expect(() => getEnv()).toThrow('FIREBASE_API_KEY');
    } finally {
      if (originalApiKey === undefined) {
        delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      } else {
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY = originalApiKey;
      }
    }
  });
});
