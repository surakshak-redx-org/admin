# Surakshak Admin Dashboard

Web-based content management and moderation panel for the Surakshak women's
safety app.

## Tech Stack

- Next.js 16 (App Router)
- TypeScript strict
- Tailwind CSS v4 + Radix UI
- Firebase Admin SDK (server-side)
- Firebase Client SDK (Google Sign-In only)
- React Query
- Vercel deployment

See `CLAUDE.md` for the full architecture rules, including the "Phase 9
Corrections" section on why this repo runs Next 16 rather than the Next 14
originally specified.

## Firebase Project

One Firebase project (`surakshak-2869a`) is shared by every tier — dev,
staging and prod all read and write the same live Firestore data. There is
no separate "staging" dataset. See `CLAUDE.md` → "Firebase Project".

## Setup

1. Clone repo and install:

   ```
   npm install
   ```

2. Copy env file:

   ```
   cp .env.example .env.local
   ```

   Fill in all values (staging Firebase project — see `.env.example`).

3. Run locally:

   ```
   npm run dev
   ```

4. Create the first admin (run once):

   First sign in with Google at http://localhost:3000/login — you'll be
   redirected back with a "not authorized" error, which is expected before
   any admin exists. Then run:

   ```
   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
   npx ts-node scripts/create-admin.ts me@dhruvchheda.com super_admin
   ```

## Features

- Dashboard with stats and quick actions
- Content management: Laws, FAQ, Safety Tips, News
- Unsafe area approvals (pending → approved with map verification)
- Community post moderation (restore or delete hidden posts)
- Incident report tracking and status updates
- User management
- Admin user management (super_admin only)

## Branches

```
production ← staging ← develop ← feature/xxx
```

`develop` only runs PR checks (typecheck/lint/prettier/build) — it never
deploys. Pushes to `staging` and `production` trigger a Vercel deploy.
