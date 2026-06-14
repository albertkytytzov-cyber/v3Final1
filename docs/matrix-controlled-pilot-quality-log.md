# Matrix Controlled Pilot Quality Log

Stage: Matrix Family-Level Evidence Review + Coach UI + Controlled Pilot Readiness.

The controlled pilot quality log helper lives in
`packages/shared/src/constructor-matrix-pilot-quality-log.ts` and is checked by
`npm run check:constructor-matrix-pilot-quality-log`.

## Purpose

The helper builds local audit entries for synthetic or controlled pilot
scenarios. It tracks plan quality without changing runtime behavior or writing
production athlete data.

Each entry records:

- scenario id;
- generated plan source;
- allowed, fallback, blocked or review-required status;
- exercise count;
- review-required count;
- blocked high-risk count;
- coach-editable load count;
- missing-data warning count;
- evidence family coverage;
- save/assign gate status;
- quality notes.

## Guardrails

- no PII;
- no production athlete id;
- no runtime behavior change;
- no fake human review;
- no medical or coach approval.
