# Codex Agent Guide

## Project Summary

PERFORM is a training-process platform for coaches and athletes. The app covers readiness tracking, training planning, competition calendars, preparation cycles, execution results, analytics, and offline-friendly workflows.

## Stack

- Monorepo: npm workspaces.
- Language: TypeScript.
- Web: Next.js App Router, React, global CSS.
- API: Fastify, PostgreSQL, cookie sessions.
- Mobile: Capacitor shell in `apps/mobile`.
- Shared package: `@training-platform/shared`.
- Runtime services: PostgreSQL, Redis, worker, scheduler, Caddy via Docker Compose.

## Commands

Setup:

```bash
npm run setup
```

Run local dev:

```bash
npm run dev
```

Lint and typecheck:

```bash
npm run check
```

Tests:

```bash
npm run test
```

Build:

```bash
npm run build
```

Mobile sync:

```bash
npm run mobile:sync
```

Self-host install/update:

```bash
bash scripts/install.sh
bash scripts/update.sh
```

## Change Rules

- Do not change business logic unless the task explicitly requires it.
- Keep edits small and aligned with existing code style.
- Do not perform broad refactors, file moves, or formatting churn without a specific reason.
- Preserve current API routes, request/response contracts, database schema behavior, and routing unless the task asks to change them.
- Prefer existing helpers and shared types over introducing new abstractions.
- Use `packages/shared` for contracts used by both web and API.

## Testing Requirements

- Run `npm run check` before handing off code changes.
- Run `npm run build` when touching shared types, API bootstrapping, Next.js routes, or production-facing UI.
- `npm run test` currently documents that no dedicated test runner exists. Add focused tests when a real runner is introduced.
- For UI changes, verify the affected flow manually in a browser and report what was checked.

## Secrets Policy

- Never commit `.env`, `.env.local`, cookies, database dumps, deployment archives, private keys, TLS keys, SSH keys, or production credentials.
- Keep `.env.example` safe: placeholders only, no real domains or secrets unless they are public non-sensitive examples.
- Treat browser profile directories under `tmp/` and `.chrome-*` as sensitive because they can contain cookies and local storage.

## Code Review Rules

When reviewing changes, lead with findings:

- Prioritize correctness bugs, regressions, security/privacy risks, data-loss risks, and missing tests.
- Reference exact files and lines where possible.
- Keep summaries secondary and concise.
- If no issues are found, state that clearly and mention remaining test gaps or manual checks.
