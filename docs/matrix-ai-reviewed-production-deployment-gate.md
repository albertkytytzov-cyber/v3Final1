# Matrix AI-reviewed production deployment gate

Stage: Production Deployment Gate.

This document is a deployment gate, not a deployment approval. It records the
minimum conditions that must be true before any production exposure of the
AI-reviewed Matrix constructor path.

## Deployment mode

Deployment mode: feature-flagged controlled pilot only.

Matrix is not production default.

High-risk medical decisions remain non-automated.

Feature flags must be off by default. Matrix may be visible only to controlled
pilot users, admins or test cohorts when explicitly enabled.

## Enabled scenarios

Allowed only when all existing gates pass:

- controlled pilot/admin/test cohort access;
- internal Matrix UI flag enabled explicitly;
- limited Matrix primary pilot flag enabled explicitly;
- existing rollout gate returns a primary-pilot-allowed scenario;
- pilot readiness passes without blockers;
- server save dry-run passes;
- `matrix.aiRuntime` remains metadata-only;
- soft-warning metadata and conservative plan-structure hint metadata are the
  only AI-reviewed runtime supports.

## Blocked scenarios

The following remain blocked:

- Matrix as production default;
- replacing `/api/v1/plans/constructor/draft`;
- broad rollout beyond the controlled pilot cohort;
- production save/template/assign path for Matrix output unless a later explicit
  approval stage enables it;
- DB schema migration for Matrix deployment;
- automatic medical, injury-return, RED-S, hydration, weight-cut or BFR/KAATSU
  decisions;
- numeric thresholds as runtime gates;
- medical or coach approval represented as human approval;
- high-risk areas promoted from blocked/fallback/review-required state.

## Rollback instructions

Rollback is feature-flag first:

- set `NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI` to off or unset;
- set `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT` to off or unset;
- set `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT` to off or unset;
- redeploy web/API from the same release if only flags changed;
- verify `/api/v1/plans/constructor/draft` still returns legacy constructor
  drafts;
- verify pilot Matrix actions are hidden or blocked;
- verify save/template/assign uses only the legacy constructor draft path.

If a code rollback is needed, revert the Matrix pilot metadata commits while
keeping the legacy constructor path intact. No DB rollback is expected because
no DB schema migration is required for this gate.

## Monitoring checklist

Before exposure:

- confirm feature flags are off by default;
- confirm only controlled cohort users receive the pilot flags;
- confirm production draft route remains legacy-backed;
- confirm legacy constructor success/error rates remain normal;
- confirm internal Matrix endpoints remain coach/admin guarded;
- confirm server save dry-run failures block Matrix activation;
- confirm blocked/fallback scenarios use legacy output;
- confirm no Matrix save/template/assign DB write occurs.

During exposure:

- monitor draft generation errors;
- monitor fallback frequency;
- monitor server dry-run blocked/error counts;
- monitor high-risk blocked/review-required metadata counts;
- monitor support reports from pilot users;
- monitor latency for internal Matrix endpoints;
- monitor that no medical, coach or human approval fields appear in output.

After exposure:

- compare pilot outputs with review export notes;
- review blocked scenarios before expanding cohort size;
- keep high-risk areas blocked until real review artifacts exist.

## Known limitations

- AI desk review is not human review.
- AI desk review is not medical approval.
- AI desk review is not coach approval.
- Source-text acquisition and manual verification remain incomplete.
- All AI-reviewed runtime eligibility records remain review-required.
- High-risk medical decisions remain non-automated.
- Matrix save/assign production enablement is not approved by this gate.
- Matrix cannot become production default from this gate.
- No DB schema migration is required.

## Required verification

Before any production deployment decision, run:

```bash
npm run check
npm run build
git diff --check
```

The deployment gate fails if:

- Matrix feature flags are on by default;
- legacy constructor is not the default;
- production `/api/v1/plans/constructor/draft` is Matrix-backed;
- a DB schema migration is required;
- save/assign production path is enabled without explicit approval;
- high-risk areas are automated;
- numeric thresholds are used as runtime gates;
- medical/coach approval is represented as human approval;
- rollback or monitoring instructions are missing.
