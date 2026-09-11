import type { NextConfig } from 'next';

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
