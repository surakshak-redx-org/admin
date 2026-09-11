import type { NextConfig } from 'next';

// TypeScript, not next.config.js — create-next-app@latest scaffolds this
// project as TS-first. Same content the Phase 9 brief specifies for
// next.config.js, just typed.
const nextConfig: NextConfig = {
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
