# Matrix Constructor Controlled Pilot Rollout

This checklist is the production smoke protocol for the internal/limited Matrix
Constructor pilot. It is intentionally operational: it does not change rollout
policy, constructor logic, DB/API contracts, storage, telemetry, mobile
contracts, or save/template/assign behavior.

## Scope

The pilot is considered deployed only after these three states are verified:

1. `flag-off` production behavior: legacy constructor works and matrix UI is
   hidden.
2. `flag-on` internal behavior: matrix preview/workspace/export can be reviewed
   without becoming the default production path.
3. Rollback behavior: disabling the flags hides matrix UI and restores the same
   legacy-only surface after rebuild/redeploy.

## Required flags

Matrix UI is controlled by build-time web flags:

```bash
NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=true
NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=true
```

The trainer-facing save/assign pilot path has a separate third flag:

```bash
NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT=true
```

This third flag is ignored unless the first two flags are also enabled. It
should stay false unless the smoke explicitly validates matrix template saving
after local and server dry-run evidence pass.

Rules:

- With both flags missing or false, matrix UI must be hidden.
- `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=true` is ignored unless
  `NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=true`.
- `NEXT_PUBLIC_MATRIX_CONSTRUCTOR_SAVE_ASSIGN_PILOT=true` is ignored unless
  both internal UI and limited primary pilot are enabled.
- Because the flags are `NEXT_PUBLIC_*`, changing them requires rebuilding the
  web app before the browser can see the new state.
- In self-host Docker deploys the flags are wired through `docker-compose.yml`
  as web build args and runtime env. Keep `.env` explicit and run
  `bash scripts/update.sh` after changing them.

## Pre-deploy checks

Run before merge/deploy:

```bash
npm run build --workspace @training-platform/shared
npm run build --workspace @training-platform/api
npm run build --workspace @training-platform/web
npm run check:constructor-core
npm run check:constructor-matrix-evidence-dependencies
npm run check:constructor-matrix-data-dependencies
npm run check:constructor-matrix-review-package
npm run check:constructor-matrix-ui-gates
npm run check:constructor-matrix-review-export
npm run check
git diff --check
```

Expected evidence:

- all commands exit successfully;
- PR is mergeable;
- production branch includes the rollout commit;
- no local uncommitted changes are required for deploy.

## Registry Hardening + Data Dependency Gate Skeleton

The production rollout checklist now includes the metadata-only evidence/data
checks. These checks do not enable Matrix by default and do not change runtime
behavior.

Required invariants:

- hardened `EvidenceDependencyRegistry` keeps high-risk evidence explicit about
  limitations, review status and automation readiness;
- internal validation and coach-school evidence are not universal hard rules;
- product rollout guards remain operational safety checks, not sport-science
  proof;
- `Data Dependency Gate Skeleton` records what data is needed for future
  weight, hydration, readiness, wearable, pain, injury, female/youth, travel and
  competition-context decisions;
- no numeric thresholds are introduced;
- production `/api/v1/plans/constructor/draft`, rollout gates, preview behavior,
  save/template/assign and legacy fallback stay unchanged.

## Production deploy

After merging to the production branch or deliberately deploying the pilot
branch:

```bash
bash scripts/update.sh
```

Then verify:

```bash
curl -fsS https://185.195.185.67.sslip.io/api/v1/health
docker compose ps
docker compose logs api --tail=100
docker compose logs web --tail=100
docker compose logs reverse-proxy --tail=100
```

Expected evidence:

- API health returns success;
- web/api/reverse-proxy containers are healthy or running;
- logs have no constructor/matrix boot errors.

## Flag-off smoke

Use production with both matrix flags absent or false, then rebuild/redeploy.

Manual browser checks:

- log in as a coach;
- open Planning Studio / Constructor;
- build a normal legacy draft;
- save/template/assign legacy flow works as before;
- no Matrix preview panel is visible;
- no Matrix workspace, Matrix activation button, primary pilot button, or
  review export action is visible;
- browser console has no errors.

Expected evidence to record:

- production URL;
- coach account used;
- date/time;
- screenshot or notes confirming matrix UI is hidden;
- legacy draft can still be generated.

## Flag-on internal smoke

Enable both flags, rebuild web, redeploy, hard-refresh the browser, then test.

Manual browser checks:

- matrix preview panel is visible only in constructor context;
- `far_development_week_d90` style scenario can build preview, rollout,
  readiness, server dry-run evidence and review export;
- matrix primary pilot can be activated only after passing server evidence;
- active `matrix_primary_pilot` draft remains review-only unless the third
  save/assign pilot flag is explicitly enabled;
- with the third flag off, save/template/assign controls stay disabled for
  `matrix_internal` and `matrix_primary_pilot`;
- return to legacy works;
- D-28/D-21/D-10 main-start scenarios can pass as limited primary candidates
  only when rollout/readiness/server dry-run are green;
- D-3 close-start scenario remains preview-only;
- travel and weigh-in scenarios remain internal-only;
- `Copy review summary` and `Copy review JSON` work and do not include athlete
  identity, contact data, raw ids or coach notes;
- browser console has no errors.

Expected evidence to record:

- production URL;
- selected athlete/scenario;
- rollout mode and readiness status;
- server dry-run status;
- export copied successfully;
- save/template/assign remained unavailable for matrix sources when the third
  flag is off;
- return-to-legacy result.

## Optional save/assign pilot smoke

Only run this smoke when the team intentionally tests real matrix template
saving. Enable all three flags, rebuild web, hard-refresh the browser, and use a
known allowed D-90-style scenario.

Manual browser checks:

- build the current draft;
- run the new constructor comparison;
- open the new plan variant;
- activate the limited pilot view;
- confirm local and server safe-save checks are passed;
- confirm the active new draft has coach-readable focus language, concrete
  blocks, warm-up, main work, cool-down/control and editable exercise rows;
- confirm the save button appears only for the active new constructor draft;
- save as template;
- verify the normal template assignment tab opens with the saved template
  preselected;
- verify the selected athlete, full-plan assignment mode and current start date
  are prefilled;
- assign the saved template to the selected athlete through the normal
  assignment flow after checking dates;
- confirm `matrix_internal`, D-3, competition day, travel and weigh-in still
  cannot save.

Expected evidence to record:

- all three flags enabled;
- selected athlete/scenario;
- local and server dry-run status;
- saved template id/name;
- assignment id/date;
- proof that blocked scenarios still do not expose save.

## Rollback smoke

Disable both flags, rebuild web and redeploy.

Manual browser checks:

- matrix preview panel disappears;
- active matrix state cannot be reopened after hard refresh;
- legacy constructor generation still works;
- production `/api/v1/plans/constructor/draft` remains legacy-backed;
- browser console has no errors.

## Main build button smoke

With all three matrix flags enabled, the trainer-facing **build draft** action
must call the controlled pilot draft path before legacy fallback:

```text
POST /api/v1/plans/constructor/internal/matrix-primary-pilot-draft
```

Expected behavior:

- allowed pilot case: the top draft is marked as the new planning logic and can
  proceed through the gated template save flow;
- blocked or preview-only case: the top draft is the current constructor
  fallback, and the message explains the matrix scenario and rollout mode;
- no DB write, template creation or plan assignment happens during this pilot
  draft request;
- production `/api/v1/plans/constructor/draft` remains legacy-backed.

Expected evidence to record:

- date/time;
- flags disabled;
- matrix UI hidden;
- legacy draft generated after rollback.

## Go/no-go decision

Continue the controlled pilot only if:

- flag-off smoke passes;
- flag-on smoke passes;
- rollback smoke passes;
- `npm run check:constructor-matrix-threshold-candidates` passes and confirms
  threshold candidates remain metadata only;
- review exports are anonymized;
- no production save/template/assign path is available for matrix sources unless
  the optional third-flag save/assign pilot smoke is being intentionally run;
- coach feedback confirms the review package is understandable.

Stop or roll back if:

- matrix UI appears when flags are off;
- D-3/travel/weigh-in can become primary production drafts;
- D-28/D-21/D-10 can save without all three web flags and green server evidence;
- save/template/assign becomes available for matrix sources while the third
  save/assign pilot flag is off;
- review export leaks identity/raw ids;
- constructor legacy flow regresses.

## Threshold candidate rollout note

The Threshold Candidate Registry is not part of production decisioning. It is a
controlled metadata layer for future coach/medical/data-quality review.

### Threshold Candidate Registry coverage patch

Stage: Threshold Candidate Registry.

The registry now meets the coverage intent before any production rollout:

- candidate count: 24;
- required area coverage: weight cut, hydration, readiness, wearable data,
  sleep, RHR, HRV, pain, injury, female context/RED-S, youth context, travel
  fatigue, competition context, contact load, LMV and taper;
- `npm run check:constructor-matrix-threshold-candidates` enforces minimum
  count, required area coverage, valid evidence/data ids, no runtime imports and
  metadata-only fixture impact;
- every candidate records `kind`, `whyNeeded`, `candidateStatement`,
  `proposedRuntimeUse`, `status`, `reviewRequired`, `futureTargetLayers` and
  `fixtureImpact.runtimeChangeAllowedNow=false`.

### Matrix Review Package

Before any future runtime promotion, the Matrix Review Package must be reviewed
outside production decisioning.

The package includes:

- coach queue;
- medical queue;
- data-quality queue;
- evidence/data/threshold summaries;
- guardrails proving no runtime behavior, production route, rollout, preview or
  legacy fallback change.

Rollout invariants:

- no numeric thresholds or cutoffs are introduced;
- no runtime gate is introduced;
- no broad Matrix default is enabled;
- no production draft route is changed;
- no preview, save/template/assign or legacy fallback behavior is changed.

Any future move from candidate metadata toward runtime behavior requires a
separate review stage, updated evidence/data dependency checks and explicit
approval.

## Matrix Review Decision Ledger rollout note

Stage: Matrix Review Decision Ledger.

The Review Decision Ledger is metadata-only governance, not production
decisioning. It records system initial triage, audit trace and review-package
queue statuses for evidence dependencies, data dependencies and threshold
candidates.

Rollout guardrails:

- no human approvals are recorded;
- all entries have `humanReviewed=false`;
- no numeric thresholds or cutoffs are introduced;
- no production route is changed;
- no rollout gate is changed;
- no preview behavior, save/template/assign behavior or legacy fallback is
  changed;
- Matrix default is not enabled;
- Huawei files and SDK scripts are unrelated to this Matrix stage.

Next step: actual coach, medical and data-quality review, or source expansion
backlog, before any runtime promotion.

## Source Expansion Backlog + Review Intake Guard rollout note

Stage: Source Expansion Backlog + Review Intake Guard.

The source-expansion backlog is metadata-only intake planning. It lists source
types, review questions, acceptance criteria and runtime blockers for future
coach, medical, data-quality and sport-science work.

Rollout guardrails:

- no sources, citations, DOI, PMID or threshold values are invented;
- no human approvals are recorded;
- Review Decision Ledger entries remain `humanReviewed=false`;
- no production route is changed;
- no rollout gate is changed;
- no preview behavior, save/template/assign behavior or legacy fallback is
  changed;
- Matrix default remains prohibited;
- Huawei files and SDK scripts remain unrelated to this Matrix stage.

Next step: actual human review pass or targeted source acquisition. Runtime
promotion requires a separate explicit stage.

## P0 Source Acquisition Dossier + Source Candidate Registry rollout note

Stage: P0 Source Acquisition Dossier + Source Candidate Registry.

The source-candidate registry and P0 dossier are metadata-only acquisition
planning. They identify source needs, acceptance criteria, rejection criteria,
extraction questions, reviewer tracks and forbidden runtime uses for unresolved
P0 gaps.

Rollout guardrails:

- no source is automatically accepted;
- no fake citations, DOI, PMID, authors or source metadata are invented;
- no numeric thresholds or cutoffs are introduced;
- no human approvals, reviewer names or review timestamps are recorded;
- every source candidate has `runtimeChangeAllowedNow=false`;
- no production route is changed;
- no rollout gate is changed;
- no preview behavior, save/template/assign behavior or legacy fallback is
  changed;
- broad Matrix default remains prohibited;
- Huawei files and SDK scripts remain unrelated to this Matrix stage.

Next step: controlled external lookup, evidence claim extraction, real
coach/medical/data-quality review or a source-candidate acceptance/rejection
ledger. Runtime promotion requires a separate explicit stage.

## P0 Controlled Source Lookup + Source Intake Registry rollout note

Stage: P0 Controlled Source Lookup + Source Intake Registry.

The source lookup intake registry is metadata-only. It records verified source
identity metadata for P0 source candidates and review context, but it does not
extract evidence claims and does not accept sources into runtime rules.

Lookup summary:

- external lookup was available;
- source lookup intake records: 14;
- verified source identities: 14;
- manual verification needed: 2;
- extraction ready: 0;
- lookup unavailable: 0;
- P0 backlog coverage: 6/6;
- P0 source-candidate coverage: 10/10.

Rollout guardrails:

- no source is accepted into rules;
- no fake citations, DOI, PMID, authors or source metadata are invented;
- no numeric thresholds or cutoffs are introduced;
- no human approvals, reviewer names or review timestamps are recorded;
- every source lookup intake record has `runtimeChangeAllowedNow=false`;
- no production route is changed;
- no rollout gate is changed;
- no preview behavior, save/template/assign behavior or legacy fallback is
  changed;
- broad Matrix default remains prohibited.

Next step: evidence claim extraction from verified sources only, manual source
verification where needed, or real coach/medical/data-quality review. Runtime
promotion requires a separate explicit stage.

## P0 Evidence Claim Extraction Registry rollout note

Stage: P0 Evidence Claim Extraction Registry.

The evidence claim extraction registry is metadata-only. It records extracted
claims only when a source lookup record is verified and extraction-safe. At this
stage, no source lookup record is extraction-ready.

Rollout summary:

- evidence claims: 0;
- evidence claim blockers: 20;
- source lookup records covered: 14/14;
- P0 source candidates covered: 10/10;
- P0 backlog items covered: 6/6;
- required high-risk areas covered by blockers.

The claim registry intentionally empty because `extractionReadyCount=0`.
Manual-verification sources and verified-but-not-ready sources are blocked from
claim extraction.

Rollout guardrails:

- claims are not runtime rules;
- claims are not human-approved;
- no numeric thresholds or cutoffs are introduced;
- no fake citations, source metadata or human approvals are added;
- no production route is changed;
- no rollout gate is changed;
- no preview behavior, save/template/assign behavior or legacy fallback is
  changed;
- broad Matrix default remains disabled.

## Evidence Claim Blocker Review Intake Pack rollout note

Stage: Evidence Claim Blocker Review Intake Pack.

The evidence claim blocker review intake pack is metadata-only. It routes every
current evidence claim blocker to reviewer questions, required artifacts,
allowed outcomes and next actions for future manual review.

Rollout summary:

- review intake registry: `packages/shared/src/constructor-matrix-evidence-claim-review-intake.ts`;
- one intake route per evidence claim blocker;
- manual-verification blockers require manual source verification before
  extraction;
- full-text/policy blockers require source text or official policy text before
  extraction;
- human-review blockers require real reviewer decisions before future
  extraction;
- runtime changes allowed now: none.

Rollout guardrails:

- review intake does not approve claims;
- review intake does not extract claims;
- no numeric thresholds or cutoffs are introduced;
- no fake citations, source metadata or human approvals are added;
- all intakes remain `humanReviewed=false`;
- no production route is changed;
- no rollout gate is changed;
- no preview behavior, save/template/assign behavior or legacy fallback is
  changed;
- broad Matrix default remains disabled.

Next step: manual source verification, human review of claim blockers or a
future extraction pass after source readiness is updated. Runtime promotion
requires a separate explicit stage.

## Matrix Review Intake Export Pack rollout note

Stage: Matrix Review Intake Export Pack.

The review intake export pack is metadata-only. It generates reviewer-specific
Markdown/JSON packets from Evidence Claim Review Intake for real-world manual
review.

Rollout summary:

- export builder: `packages/shared/src/constructor-matrix-review-intake-export.ts`;
- generated export docs: `docs/matrix-review-intake-export/`;
- audiences: manual source verification, source text acquisition, coach,
  medical, data-quality, sport-science and product-safety review;
- runtime changes allowed now: none.

Rollout guardrails:

- export pack does not approve anything;
- export pack does not extract claims;
- export pack does not update source readiness;
- no numeric thresholds or cutoffs are introduced;
- no fake citations, source metadata or human approvals are added;
- no production route is changed;
- no rollout gate is changed;
- no preview behavior, save/template/assign behavior or legacy fallback is
  changed;
- broad Matrix default remains disabled.

Next real-world step: manual source verification and reviewer completion
outside code. Next code stage after real review: Source Readiness Update from
Human Review Results.

## Matrix Desk Source Review + Evidence Claim Candidate Extraction rollout note

Stage: Matrix Desk Source Review + Evidence Claim Candidate Extraction.

The desk source review and evidence claim candidate registries are
metadata-only. They sit after SourceLookupIntake and before any future human
review, manual source verification or source readiness update:

SourceLookupIntake -> DeskSourceReviewRegistry ->
EvidenceClaimCandidateRegistry -> future human review / source verification /
extraction pass.

Rollout summary:

- desk review registry:
  `packages/shared/src/constructor-matrix-desk-source-review.ts`;
- claim candidate registry:
  `packages/shared/src/constructor-matrix-evidence-claim-candidates.ts`;
- 14 desk source reviews cover the 14 source lookup records;
- 15 claim candidates remain candidate-only review context;
- runtime changes allowed now: none.

Rollout guardrails:

- desk source review is not human review;
- claim candidates are not final evidence claims;
- claim candidates are not runtime rules;
- manual-verification-needed sources remain blocked for final extraction;
- source readiness is not updated;
- no medical approval, coach approval, fake human approval, reviewer name,
  review date, fake citation or fake source metadata is added;
- no numeric threshold or cutoff value is added;
- no production route is changed;
- no rollout gate is changed;
- no preview behavior, save/template/assign behavior or legacy fallback is
  changed;
- broad Matrix default remains disabled.

Next stage: real human/manual source review or Source Readiness Update from
Human Review Results. Runtime promotion requires a separate explicit stage.

## Matrix Evidence Claim Candidate Review Export Pack rollout note

Stage: Matrix Evidence Claim Candidate Review Export Pack.

The claim candidate review export pack is metadata-only. It creates
reviewer-specific Markdown/JSON packets from Evidence Claim Candidates for
future real-world review.

Rollout summary:

- export builder:
  `packages/shared/src/constructor-matrix-evidence-claim-candidate-review-export.ts`;
- generated export docs: `docs/matrix-claim-candidate-review-export/`;
- audiences: coach, medical, data-quality, sport-science, product-safety,
  manual source verification and source text acquisition;
- evidence claim candidates covered: 15;
- export items: 80;
- runtime changes allowed now: none.

Rollout guardrails:

- export pack is for human reviewers, but is not human review;
- it exports candidate-only claims, not final claims;
- it does not approve anything;
- it does not update source readiness;
- no numeric thresholds or cutoffs are introduced;
- no fake citations, source metadata or human approvals are added;
- no production route is changed;
- no rollout gate is changed;
- no preview behavior, save/template/assign behavior or legacy fallback is
  changed;
- broad Matrix default remains disabled.

Next real-world step: manual source verification, full-text acquisition and
reviewer completion outside code. Next code stage after real review: Source
Readiness Update from Human Review Results. Runtime promotion requires a
separate explicit stage.

## AI-reviewed Matrix preparation pilot rollout note

Stage: Matrix Preparation Plan Pilot with AI-reviewed runtime metadata.

The controlled pilot can now expose AI-reviewed runtime eligibility metadata
inside the matrix draft as `matrix.aiRuntime`. This is not a production default
and not a medical, coach or human approval layer.

Pilot scope:

- enabled only through the existing internal/limited pilot feature flags;
- uses existing Matrix structure, rollout gates, pilot readiness and server
  dry-run evidence;
- exposes soft-warning eligibility ids, plan-structure hint eligibility ids,
  high-risk blocked ids and review-required ids as metadata;
- keeps all high-risk medical/clinical/weight-cut/hydration/injury/RED-S/BFR
  decisions non-automated;
- keeps `runtimeHardGatesEnabled=false`,
  `numericThresholdRuntimeGatesEnabled=false`,
  `medicalDecisionAutomationEnabled=false` and `humanReviewed=false`.

Rollout guardrails:

- production `/api/v1/plans/constructor/draft` remains legacy-backed;
- Matrix default remains disabled;
- rollout allowlists are unchanged;
- save/template/assign remains unavailable for `matrix_primary_pilot` unless
  the separate explicit save/assign pilot flag and checks are used;
- no DB schema or API contract change is required;
- no numeric thresholds, fake citations or fake human approvals are added.

Automated coverage:

- `npm run check:constructor-matrix-ai-runtime-integration`;
- `npm run check:constructor-matrix-ui-gates`;
- `npm run check:constructor-core`.

## AI-reviewed Matrix save/assign readiness audit

Stage: AI-reviewed Matrix Save/Assign Readiness.

The save/assign audit is documented in
`docs/matrix-ai-reviewed-save-assign-readiness.md` and checked by
`npm run check:constructor-matrix-ai-save-assign-readiness`.

Rollout meaning:

- Matrix pilot drafts are structurally compatible with existing template and
  assignment payload schemas in dry-run checks;
- no production DB write path is enabled;
- legacy constructor save remains the default save-capable path;
- Matrix save/assign remains blocked unless a future explicit save/assign pilot
  approval changes the boundary;
- production route, rollout gates, preview behavior, legacy fallback and DB
  schema remain unchanged;
- high-risk decisions remain non-automated and review-required.

## AI-reviewed Matrix production decision pack

Stage: Final Matrix Decision Pack.

`docs/matrix-ai-reviewed-production-decision-pack.md` records the current
production decision:

- controlled preparation-plan building is allowed for feature-flagged pilot
  users/admin/test cohorts only;
- Matrix is not production default;
- legacy fallback remains the production default path;
- AI-reviewed metadata can support docs/review export, soft-warning metadata,
  conservative plan-structure hint metadata and blocked/review-required
  metadata;
- high-risk medical decisions remain non-automated;
- no numeric thresholds, fake citations or fake human approvals are approved.

## Matrix AI-reviewed production deployment gate

Stage: Production Deployment Gate.

The deployment gate is documented in
`docs/matrix-ai-reviewed-production-deployment-gate.md`.

Deployment mode remains feature-flagged controlled pilot only:

- feature flags are off by default;
- Matrix is not production default;
- legacy constructor remains default;
- production `/api/v1/plans/constructor/draft` remains unchanged;
- no DB schema migration is required;
- save/assign production path is not enabled without a later explicit approval;
- rollback and monitoring checklists are documented;
- all high-risk areas remain blocked, fallback-only or review-required;
- no numeric thresholds are used as runtime gates;
- no medical or coach approval is represented as human approval.
