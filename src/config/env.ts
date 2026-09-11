import { z } from 'zod';

const clientEnvSchema = z.object({
  APP_ENV: z.enum(['dev', 'staging', 'prod']),
  FIREBASE_API_KEY: z.string().min(1),
  FIREBASE_AUTH_DOMAIN: z.string().min(1),
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_STORAGE_BUCKET: z.string().min(1),
  FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  FIREBASE_APP_ID: z.string().min(1),
  APP_URL: z.string().url(),
});

const parsed = clientEnvSchema.safeParse({
  APP_ENV: process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV,
  FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
});

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((i) => `  • ${String(i.path[0])}: ${i.message}`)
    .join('\n');
  throw new Error(
    `\n❌ Admin dashboard startup failed — invalid env vars:\n${missing}\n` +
      `\nCopy .env.example to .env.local and fill in all values.\n`,
  );
}

export const ENV = parsed.data;
export type AppEnv = typeof ENV.APP_ENV;
