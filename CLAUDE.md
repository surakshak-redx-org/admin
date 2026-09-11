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
