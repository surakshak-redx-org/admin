# CLAUDE.md — Surakshak Admin Dashboard

> Read this before doing anything. All decisions are final.

## Project

- Name: Surakshak Admin Dashboard
- Purpose: Content management and moderation for the Surakshak
  women's safety app
- Repo: surakshak-redx-org/admin
- App Repo: surakshak-redx-org/app (separate)

## Tech Stack

- Framework: Next.js 14, App Router
- Language: TypeScript strict
- Styling: Tailwind CSS + Radix UI
- Auth: Firebase Client SDK (Google Sign-In)
- Database: Firebase Admin SDK (server-side only)
- State: React Query
- Deploy: Vercel

## Absolute Rules — Same as App Repo

1. No `any` type
2. No `// @ts-ignore` or `// @ts-expect-error`
3. No `// eslint-disable` comments
4. All functions must have explicit return types
5. All component props must have typed interfaces
6. No inline styles — Tailwind classes only
7. No magic numbers or strings — use constants

## Architecture

- Server Components for data fetching (use Firebase Admin SDK)
- Client Components only where interactivity needed (use 'use client')
- API routes for mutations (POST/PUT/PATCH/DELETE)
- Never use Firebase Client SDK except for Google Sign-In
- Never expose service account credentials in client-side code

## Auth

- Google Sign-In via Firebase Client SDK
- Admin whitelist in Firestore: admins/{uid}
- Server-side: verify ID token in every API route via verifyAdminToken()
- Roles: admin (default), super_admin (full access)
- super_admin only: add/remove admins, access /admins page

## Firebase Project

One shared Firebase project (`surakshak-2869a`) across every tier — same as
the app and functions repos. There are no separate staging/production
Firebase projects: the "staging" Vercel deployment reads and writes the same
live Firestore data as production. `APP_ENV` (dev/staging/prod) only affects
which Vercel build/branch is running, not which Firestore is behind it. If
this repo's Firebase project is ever split, update this section and the
GitHub Actions secrets accordingly.

## Environments

dev/staging/prod → all surakshak-2869a Firebase project

## Branch Strategy

production ← staging ← develop ← feature/xxx

---

## Phase 9 Corrections (2026-09-11)

The Phase 9 brief this repo was scaffolded from names "Next.js 14" and gives
config files (`.eslintrc.js`, ESLint 8-style rules) written against that
baseline. `create-next-app@latest` no longer offers Next 14 — it scaffolds
whatever is current. Same situation as the app repo's own Phase 1
Corrections, and resolved the same way: adopt current tooling, document the
drift here, don't pin a deprecated major version to match old prose.

| Topic    | Brief                    | Shipped                                                             | Reason                                                  |
| -------- | ------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------- |
| Next.js  | 14                       | **16.x**                                                            | `create-next-app@latest` no longer offers 14            |
| React    | 18 (implied by Next 14)  | **19.x**                                                            | ships with Next 16                                      |
| ESLint   | `.eslintrc.js`, ESLint 8 | **`eslint.config.mjs`** (flat), `eslint@^9`                         | `eslint-config-next` 16 ships flat-config exports only  |
| Tailwind | v3, `tailwind.config.js` | **v4**, CSS-first config via `@import "tailwindcss"` in globals.css | ships with `create-next-app@latest`'s `app-tw` template |

All of the brief's _behavioral_ ESLint rules (`no-explicit-any`,
`explicit-function-return-type`, `no-floating-promises`, `import/order`,
etc.) are preserved — just expressed as flat-config entries instead of an
`.eslintrc.js` `extends` array.

## Firebase Secrets Architecture Deviation

The Phase 9 brief's GitHub Actions / Vercel setup assumes two Firebase
projects (`_STAGING` / `_PROD` suffixed secrets). This repo uses **one**
`FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64` secret and one
`NEXT_PUBLIC_FIREBASE_*` secret set for every tier — see "Firebase Project"
above.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
