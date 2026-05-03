# PERFORM Training Platform

PERFORM is a training-process management platform for coaches and athletes. It combines readiness tracking, training planning, competition calendars, preparation cycles, execution results, analytics, and offline-friendly web workflows.

## Technology Stack

- Node.js workspace monorepo with npm workspaces.
- TypeScript across shared types, API, web app, and mobile app.
- Next.js App Router, React, and CSS modules/global CSS for the web application.
- Fastify API with cookie sessions for web and bearer session tokens for mobile.
- PostgreSQL for persistence and Redis for background/runtime coordination.
- Docker Compose for self-hosted deployment with PostgreSQL, Redis, API, web, worker, scheduler, and Caddy reverse proxy.
- ESLint and TypeScript checks for quality gates.

## Project Structure

```text
apps/
  api/                 Fastify API, background worker, scheduler, database bootstrap
  web/                 Next.js application and static assets
  mobile/              Capacitor app with bundled mobile UI for Android and iOS
packages/
  shared/              Shared TypeScript domain types and constants
infra/
  caddy/               Caddy reverse-proxy config
  postgres/init/       Initial PostgreSQL schema
docs/                  Architecture and self-host deployment notes
scripts/               Setup, run, lint, test, deploy, backup, restore helpers
docker-compose.yml     Production/self-host compose stack
```

Generated output such as `node_modules`, `.next`, `dist`, local browser profiles, logs, screenshots, archives, database backups, and `.env` files must stay outside Git.

## Local Installation

Prerequisites:

- Node.js 22 or newer.
- npm.
- PostgreSQL and Redis for full local API usage, or Docker for the compose stack.

Install dependencies:

```bash
npm run setup
```

Linux/CI equivalent:

```bash
bash scripts/setup.sh
```

## Environment Setup

Copy the safe template and fill local values:

```bash
cp .env.example .env
```

Important variables:

- `DATABASE_URL` - PostgreSQL connection string for the API.
- `REDIS_URL` - Redis connection string for worker/scheduler support.
- `SESSION_SECRET` - strong random secret, at least 32 characters for production.
- `POSTGRES_PASSWORD` - strong PostgreSQL password for Docker Compose.
- `PUBLIC_HOST` - production domain or temporary `sslip.io`/`nip.io` host.
- `NEXT_PUBLIC_API_BASE_URL` - browser-visible API base path, normally `/api/v1`.

Do not commit `.env`, real passwords, cookies, database dumps, SSH keys, TLS keys, or production archives.

## Run

Run the web and API dev servers:

```bash
npm run dev
```

Linux/CI equivalent:

```bash
bash scripts/run.sh
```

Default local URLs:

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/api/v1/health`

For the full Docker stack:

```bash
docker compose up --build
```

For production-style install/update, use the existing deployment helpers only after `.env` is configured with strong values:

```bash
bash scripts/install.sh
bash scripts/update.sh
```

## Tests

There is no dedicated automated test runner configured yet. The placeholder test script documents that state and exits successfully:

```bash
npm run test
```

Before adding a real test suite, keep the script name stable and wire it to the chosen runner.

## Lint / Check

Run lint and type checks:

```bash
npm run check
```

Linux/CI equivalent:

```bash
bash scripts/lint.sh
```

Individual commands:

```bash
npm run lint
npm run typecheck
npm run build
```

## Mobile App

The mobile app lives in `apps/mobile`. It uses Capacitor, but the UI is bundled inside the app instead of loading the deployed web site. The server is used only as the API backend.

Configure a local mobile API URL without committing it:

```bash
cp apps/mobile/mobile.env.example apps/mobile/.env.mobile.local
```

Then set `MOBILE_API_BASE_URL` in `apps/mobile/.env.mobile.local`, build the mobile assets, and sync native projects:

```bash
npm run mobile:build
```

```bash
npm run mobile:sync
```

Android can be opened on Windows with Android Studio:

```bash
npm run mobile:open:android
```

iOS requires Xcode on macOS or a cloud build flow:

```bash
npm run mobile:open:ios
```

## Development Rules

- Keep business logic changes scoped and intentional.
- Prefer existing module boundaries: `apps/web`, `apps/api`, and `packages/shared`.
- Keep shared API contracts in `packages/shared` when both web and API need them.
- Do not commit generated build output, caches, local logs, browser profiles, screenshots, cookies, database dumps, or archives.
- Do not commit real secrets. Update `.env.example` only with safe placeholders.
- Run `npm run check` and `npm run build` before opening a pull request or first commit.
- Add focused tests when introducing behavior with meaningful risk. If no test harness exists for the changed area, document the manual verification.
