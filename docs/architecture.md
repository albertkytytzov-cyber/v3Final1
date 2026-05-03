# Architecture Overview

## Product focus

MVP currently covers the following product areas from the specification:

1. `Plan Engine` - day planning with a `Day -> Session -> Block -> Exercise` structure.
2. `Readiness Engine v1` - daily athlete state input and `green/yellow/red` scoring.
3. `Competition Planning` - competition calendar, season structure, Olympic cycle planning, and preparation context.
4. `Adaptation Engine v1` - safe load adjustment without breaking the intent of the training day.
5. `Execution Tracking + Analytics` - actual execution capture and core trend views.

## Workspace layout

```text
apps/
  web/        Next.js 16 App Router, PWA-ready UI
  api/        Fastify API, business rules, integrations
packages/
  shared/     Domain types, enums, contracts
infra/
  nginx/      Reverse proxy config for self-hosted MVP
  postgres/   SQL init for local/self-hosted setup
docs/         Architecture and product notes
scripts/      Install, update, backup, and restore helpers
```

## Core roles

- `Coach` - manages plans, competition context, readiness review, adaptation, and analytics.
- `Athlete` - submits readiness, sees assigned and adapted work, records actual execution.
- `Admin` - manages access, system settings, audit visibility, and infrastructure.

## MVP bounded context

### Planning

- Plan templates and assigned plans.
- Blocks with priority, mandatory flags, and remove/reduce rules.

### Competition Planning

- Competition calendar and target events.
- Season planning per athlete with `single_peak`, `double_peak`, or `multi_peak` strategy.
- Olympic cycle planning for multi-year preparation.
- Context provider used upstream by readiness and adaptation:
  `daysToCompetition`, `competitionPriority`, `phase`, `taperState`, `weightCutState`.

### Readiness

- Daily state questionnaire.
- Normalized score and explainability factors.
- Red-flag overrides plus competition-aware interpretation.

### Adaptation

- Rule application to the assigned day.
- Result persisted as `adapted_plan_json` and an action summary.
- Competition-aware behavior for taper, recovery, and close-to-start days.

### Execution

- Actual values for `sets/reps/weight/duration/RPE`.
- Plan-vs-actual comparison.

### Analytics

- Readiness trend.
- Load and adherence trend.
- Plan-vs-actual deltas and accumulated training load.

## Initial technical choices

- `Web`: Next.js 16, React 19, TypeScript.
- `API`: Fastify 5, TypeScript.
- `DB`: PostgreSQL 16.
- `Cache / background`: Redis 7.
- `Deployment`: Docker Compose for self-hosted Ubuntu.

## Self-host MVP runtime

- `reverse-proxy`: nginx entrypoint for web and `/api/v1`.
- `web`: Next.js standalone frontend.
- `api`: Fastify API with healthcheck.
- `postgres`: persistent PostgreSQL data volume.
- `redis`: persistent append-only Redis volume.
- `worker`: background cleanup runtime.
- `scheduler`: lightweight scheduled runtime for operational analytics/log tasks.
- `scripts/install.sh`, `scripts/update.sh`, `scripts/backup.sh`, and `scripts/restore.sh`
  provide the MVP deployment path documented in `docs/deployment-self-host.md`.

## Suggested sprint order

1. Auth, workspace shell, athlete onboarding.
2. Readiness form + score calculation + explanations.
3. Plan template builder and plan assignment.
4. Competition planning.
5. Day adaptation rules and adapted day view.
6. Execution logging and analytics dashboards.
7. Offline sync and self-host deployment.
8. Audit trail, export/reporting.

## Key non-functional requirements from the spec

- Mobile-first primary flows.
- Readiness input within 20-30 seconds.
- Explainable recommendations, not black-box automation.
- Offline-first data capture with sync recovery.
- Secure role isolation and auditability.
