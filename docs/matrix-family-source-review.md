# Matrix Family Source Review

Stage: Matrix Family-Level Evidence Review + Coach UI + Controlled Pilot Readiness.

The family source review registry lives in
`packages/shared/src/constructor-matrix-family-source-review.ts` and is checked
by `npm run check:constructor-matrix-family-source-review`.

## Scope

The registry records AI desk review of public source metadata for all exercise
evidence families. It stores source identity, source type, URL/PMID/DOI only
where verified, extraction readiness, limitations and allowed use.

This is not human review and not source-text final approval.

## Source Classes

Used source classes include:

- official wrestling policy and regulation documents;
- peer-reviewed position stands;
- consensus statements;
- meta-analyses;
- wrestling-specific or combat-sport sources where available.

## Guardrails

- `reviewedBy` is exactly `AI desk review`;
- `humanReviewed=false`;
- `runtimePromotionAllowedNow=false`;
- no fake citations;
- no fake medical or coach approvals;
- no source passage is invented;
- high-risk families remain blocked, warning-only or review-export-only.

## Current Result

All 26 evidence families have at least one source review entry.
Safe training families can support coach-editable controlled-pilot content.
High-risk medical, weight-cut, hydration, BFR/KAATSU, RED-S, pain, injury and
youth decisions remain non-automated.
