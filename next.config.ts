import type { NextConfig } from 'next';

// TypeScript, not next.config.js — create-next-app@latest scaffolds this
// project as TS-first. Same content the Phase 9 brief specifies for
// next.config.js, just typed.
const nextConfig: NextConfig = {
  // firebase-admin pulls in jwks-rsa -> jose, which ships ESM-only files;
  // bundling it (Turbopack's default) breaks require() interop with those
  // files at runtime. Keeping it external makes Next.js load it natively
  // from node_modules in the deployed function instead of bundling it.
  serverExternalPackages: ['firebase-admin'],
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
