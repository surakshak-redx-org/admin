import type { NextConfig } from 'next';

/**
 * API responses carry admin-only data (users, incidents, reporters). `no-store`
 * keeps the browser and any proxy from caching them, so they cannot be replayed
 * from cache after sign-out. Next.js may replace this header on statically
 * prerendered pages; those are client-rendered shells with no data, and
 * AuthProvider reloads any page restored from the back/forward cache.
 * `/api/health` is excluded because it sets its own caching headers.
 */
const NO_STORE_SOURCE = '/((?!api/health$|_next/static|_next/image|favicon.ico).*)';
const NO_STORE_HEADERS = [{ key: 'Cache-Control', value: 'no-store, max-age=0' }];

// TypeScript, not next.config.js — create-next-app@latest scaffolds this
// project as TS-first. Same content the Phase 9 brief specifies for
// next.config.js, just typed.
const nextConfig: NextConfig = {
  // firebase-admin is already in Next's default serverExternalPackages list,
  // but its transitive deps jwks-rsa -> jose (ESM-only) are not, so Turbopack
  // still traces/bundles them and breaks require() interop at runtime
  // (ERR_REQUIRE_ESM). Marking them external too makes Next.js load them
  // natively via Node's own require from node_modules in the deployed
  // function, instead of bundling them.
  serverExternalPackages: ['firebase-admin', 'jose', 'jwks-rsa'],
  headers: () => Promise.resolve([{ source: NO_STORE_SOURCE, headers: NO_STORE_HEADERS }]),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
};

export default nextConfig;
