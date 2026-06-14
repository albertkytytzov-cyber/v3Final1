# AI-reviewed Matrix save/assign readiness audit

Stage: AI-reviewed Matrix Save/Assign Readiness.

This audit covers whether the AI-reviewed Matrix pilot output can be converted
into existing template and assignment payload shapes. It does not enable real
Matrix save, template creation, assignment, auto-assignment, DB writes or
production persistence by default.

## Current mode

- Legacy constructor drafts remain the only save-capable constructor drafts by
  default.
- `matrix_internal` and `matrix_primary_pilot` drafts remain read-only unless a
  later explicit save/assign pilot stage changes that boundary.
- Matrix primary pilot save/assign is guarded by
  `NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI`,
  `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT` and
  `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT`.
- All Matrix feature flags are off by default.
- The production route `/api/v1/plans/constructor/draft` remains backed by the
  legacy constructor path.
- Internal Matrix pilot endpoints remain coach/admin guarded and require athlete
  access.

## Compatibility findings

Template payload compatibility:

- Controlled Matrix pilot drafts can build the existing constructor template
  payload shape.
- The payload keeps days, sessions, blocks and exercise rows in the same schema
  family used by the legacy constructor.
- Internal Matrix metadata is not serialized into the template payload.
- AI-reviewed runtime metadata remains in draft metadata only and is not used as
  a save-time runtime gate.

Assignment payload compatibility:

- Existing assignment and full-plan auto-assignment request schemas can parse
  payloads derived from Matrix pilot template candidates.
- The current audit only proves schema compatibility and dry-run shape
  compatibility.
- It does not create assigned plans and does not write database rows.

Dry-run status:

- Allowed controlled pilot scenarios pass the server save dry-run.
- Blocked/fallback scenarios stay blocked or use legacy fallback output.
- Passing dry-run means the candidate is structurally compatible; it is not a
  permission to save Matrix output in production.

## Blocked scenarios

The following remain blocked for real Matrix save/assign:

- Matrix as production default;
- save/assign from `matrix_internal`;
- save/assign from `matrix_primary_pilot` without the explicit save/assign pilot
  feature flag;
- high-risk medical, clinical, injury-return, RED-S, BFR/KAATSU, hydration or
  weight-cut decisions;
- numeric thresholds as runtime gates;
- any claim represented as human, medical or coach approval.

## Boundaries

- No DB schema migration is required.
- No production save/assign path is enabled by this audit.
- Legacy fallback remains available and remains the default production behavior.
- Rollout gates, preview behavior, risk logic, volume logic, block selection and
  block eligibility are unchanged.
- High-risk areas remain blocked, fallback-only or review-required.
- No numeric threshold values are approved.
- No fake human approvals are added.

## Required checks

```bash
npm run check:constructor-matrix-ai-save-assign-readiness
npm run check:constructor-matrix-ui-gates
npm run check:constructor-core
npm run check
npm run build
git diff --check
```

## Next step

The next stage is the AI-reviewed Matrix production decision pack. A later
save/assign production enablement stage would need an explicit approval prompt,
separate feature-flag policy, rollback plan, monitoring plan and production DB
write review.
