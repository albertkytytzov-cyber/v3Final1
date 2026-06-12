# Constructor Matrix Preview Regression Fixtures

Дата: 2026-06-09.

Назначение: зафиксировать regression fixture pack для internal matrix-vs-legacy constructor preview. Fixtures проверяют не полный snapshot draft, а устойчивые инварианты: safety, block selection, risk codes, explanations и legacy default guard.

## Где лежат fixtures

Fixture pack:

```text
scripts/fixtures/constructor/preview-regression-fixtures.mjs
```

Runner:

```text
scripts/constructor-preview-fixture-runner.mjs
```

Runner подключён в:

```text
scripts/check-perform-constructor-core.mjs
```

Evidence dependency coverage check:

```text
scripts/check-constructor-matrix-evidence-dependencies.mjs
```

Data dependency skeleton check:

```text
scripts/check-constructor-matrix-data-dependencies.mjs
```

Internal/debug API endpoint, который использует тот же preview response helper:

```text
POST /api/v1/plans/constructor/internal/matrix-preview
```

Запуск:

```bash
npm run check:constructor-core
npm run check:constructor-matrix-evidence-dependencies
npm run check:constructor-matrix-data-dependencies
npm run check
```

## Формат fixture

Каждый fixture содержит:

```text
id
title
description
input
expectations
```

`input` — synthetic `ConstructorInput`. Данные не являются реальными данными спортсменов.

`expectations.legacy`:

- `shouldBuild`

`expectations.matrix`:

- `shouldBuild`
- `safeToPreview`
- `forbiddenSelectedBlockTypes`
- `requiredSelectedBlockTypes`
- `requiredAnySelectedBlockTypes`
- `requiredExplanationKeywords`
- `forbiddenRiskCodes`
- `requiredRiskCodes`
- `maxErrorCount`
- `maxWarningCount`
- `requireEveningSession`

`expectations.comparison`:

- `allowedDifferenceCategories`
- `forbiddenDifferenceSeverities`
- `legacyDefaultMustRemainUnchanged`

TypeScript-документация формата экспортируется из `packages/shared/src/constructor-matrix-preview.ts`:

- `ConstructorPreviewFixture`;
- `ConstructorPreviewFixtureLegacyExpectations`;
- `ConstructorPreviewFixtureMatrixExpectations`;
- `ConstructorPreviewFixtureComparisonExpectations`.

## Какие сценарии покрыты

Текущий pack содержит 12 synthetic fixtures:

1. `main_start_d28_special_pre_competition`
2. `main_start_d21_controlled_volume`
3. `main_start_d10_taper`
4. `main_start_d4_start_window`
5. `main_start_d3_final_activation`
6. `travel_day`
7. `weigh_in_day`
8. `competition_day`
9. `post_competition_day`
10. `secondary_start_d10`
11. `far_development_week_d90`
12. `missing_readiness_data`

## Какие инварианты проверяет runner

Runner проверяет:

- `buildConstructorComparisonPreview(input)` не падает;
- `generatedFrom === "legacy_matrix_comparison_preview"`;
- `mode === "comparison_preview"`;
- legacy draft строится;
- matrix draft строится;
- comparison report строится;
- `defaultPathUnchanged === true`;
- legacy default guard зелёный;
- preview не мутирует fixture input;
- `safeToPreview` совпадает с ожиданием;
- forbidden selected block types отсутствуют;
- required selected block types присутствуют;
- required-any groups содержат хотя бы один block type;
- forbidden risk codes отсутствуют;
- required risk codes присутствуют;
- required explanation keywords есть в combined explanation text;
- matrix safety errors не превышают `maxErrorCount`;
- comparison errors не превышают `maxErrorCount`;
- forbidden difference severities отсутствуют;
- allowed difference categories не нарушены, если они заданы;
- evening session присутствует, если fixture это требует.

Дополнительно `check-perform-constructor-core.mjs` проверяет API response helper:

- `includeDrafts=false`;
- `includeComparisonReport=false`;
- `includeSafetyDetails=false`;
- D-3 main start;
- travel day;
- weigh-in day;
- no input mutation;
- `defaultPathUnchanged`.

## Controlled rollout gate checks

Этап 10 добавил отдельный rollout gate:

```text
packages/shared/src/constructor-matrix-rollout.ts
```

Fixture pack остаётся preview/safety базой, а `check-perform-constructor-core.mjs` дополнительно
проверяет controlled rollout decision:

- `far_development_week_d90` -> `scenario=far_development_week`, `mode=matrix_allowed_for_primary`, `matrixPrimaryAllowed=true`;
- `post_competition_day` -> `scenario=post_competition_recovery`, `mode=matrix_allowed_for_primary`;
- `travel_day` -> `scenario=travel_day`, `mode=matrix_allowed_for_internal`;
- `weigh_in_day` -> `scenario=weigh_in_day`, `mode=matrix_allowed_for_internal`;
- `main_start_d28` -> `scenario=main_start_d28_preview`, `mode=matrix_allowed_for_primary`;
- `main_start_d21` -> `scenario=main_start_d21_preview`, `mode=matrix_allowed_for_primary`;
- `main_start_d10` -> `scenario=main_start_d10_preview`, `mode=matrix_allowed_for_primary`;
- `main_start_d4` -> `scenario=main_start_d4_start_window`, `mode=matrix_allowed_for_primary`;
- `main_start_d3` -> `scenario=main_start_d3_preview`, `mode=preview_only`;
- `competition_day` -> `scenario=competition_day_preview`, `mode=preview_only`;
- `unknown` -> `legacy_only` или `blocked` с явным blocker;
- `explicitly_disabled` -> `blocked`;
- `buildMatrixConstructorDraftIfAllowed` returns matrix for primary-allowed far development and main-start D-28/D-21/D-10/D-4, while D-3 still falls back/blocks;
- rollout decision не мутирует input;
- default `buildPerformConstructorDraft` остаётся legacy.
- every selected Matrix block in fixture scenarios carries typed evidence dependencies;
- every Matrix risk check in fixture scenarios carries typed evidence dependencies.

## Registry Hardening + Data Dependency Gate Skeleton

This stage keeps preview behavior unchanged. The fixture pack still checks
Matrix-vs-legacy safety and rollout invariants; it does not become a runtime
data-confidence engine.

What changed around fixtures:

- `EvidenceDependencyRegistry` now includes `riskAreas`, `auditRefs`,
  `automationReadiness`, `reviewStatus` and `ruleNature`;
- high-risk evidence dependencies must expose limitations and cannot become
  automatic universal hard rules;
- Matrix selected blocks and risk checks still carry evidence ids as before,
  but the verifier now also blocks generic-only evidence for Matrix blocks;
- `packages/shared/src/constructor-matrix-data-dependencies.ts` documents the
  missing-data requirements for future weight/readiness/wearable/pain/hydration
  decisions;
- no numeric thresholds were added;
- preview, rollout, pilot readiness, save/template/assign, production draft and
  legacy fallback behavior are unchanged.

Additional check:

```bash
npm run check:constructor-matrix-data-dependencies
```

Отдельный internal endpoint:

```http
POST /api/v1/plans/constructor/internal/matrix-rollout-decision
```

Он возвращает только decision, не full drafts, не пишет в DB и не меняет production draft route.

## Internal UI rollout status

Stage 11 не меняет fixture pack, но подключает rollout decision к internal UI panel.

UI использует те же rollout modes, которые проверяются в `check-perform-constructor-core.mjs`:

- primary allowed;
- internal only;
- preview only;
- legacy default;
- blocked.

Read-only matrix candidate показывается только для primary/internal-allowlisted scenarios.
D-28/D-21/D-10/D-3 и competition day остаются preview-only и candidate в UI скрывают.

Internal web preview panel использует тот же response shape через
`POST /api/v1/plans/constructor/internal/matrix-preview`. Поэтому fixture runner остаётся главным
автоматическим safety-слоем для данных, которые UI показывает как summary/safety/differences.

## Internal UI matrix workspace

Stage 12 добавляет read-only workspace поверх тех же preview/rollout responses.

Workspace можно открыть только для:

- `matrix_allowed_for_primary`;
- `matrix_allowed_for_internal`.

Workspace не открывается для:

- `preview_only`;
- `legacy_only`;
- `blocked`;
- safety errors;
- changed legacy default guard;
- missing matrix draft.

Workspace показывает matrix draft в визуальном формате weeks/days/sessions/blocks, но не подключён к:

- save template;
- assign plan;
- DB writes;
- `constructorDraft` replacement;
- mobile contracts.

Fixture runner остаётся data-safety источником. UI manual check должен подтвердить:

- far development D-90 opens workspace;
- close main-start D-3 remains disabled/preview-only;
- workspace contains no save/template/assign controls.

## Internal matrix draft activation

Stage 13 добавляет controlled activation поверх workspace:

```text
Использовать matrix как internal draft
```

Activation использует тот же allowlist/gate, что и workspace:

- `matrix_allowed_for_primary`;
- `matrix_allowed_for_internal`;
- safe preview;
- unchanged legacy default guard;
- no safety error blockers;
- no rollout error blockers.

Manual UI verification для activation:

- far development D-90 opens workspace and enables activation;
- after activation the main draft area shows `matrix_internal · read-only`;
- save/template/assign controls are hidden/disabled for `matrix_internal`;
- returning to legacy restores legacy draft and save template action;
- close main-start D-3 remains preview-only and cannot activate matrix.

Fixture runner остаётся data-safety источником. Stage 13 intentionally does not add snapshot testing for the React UI state and does not write matrix activation to DB, localStorage or sessionStorage.

## Matrix UI decomposition

Stage 14 выносит internal matrix UI из `page-client.tsx` в focused components/helpers:

- preview panel;
- rollout decision card;
- read-only workspace;
- active internal draft banner;
- draft read-only renderer;
- pure UI helper functions.

Fixture runner не меняется и по-прежнему проверяет data-safety инварианты. UI decomposition intentionally does not add React snapshot fixtures and does not change activation, rollout, save/template/assign, DB, storage, mobile, or production draft behavior.

## Internal matrix UI feature flag

Stage 15 hides the internal matrix UI unless this web flag is explicitly enabled:

```bash
NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=true
```

Fixture runner remains unchanged because the flag controls only React UI visibility. Data-safety fixtures continue to validate preview, rollout, and constructor invariants independent of whether the internal web panel is mounted.

Manual UI verification must cover:

- flag off: legacy constructor works and matrix panel is hidden;
- flag on: Stage 14 matrix preview/workspace/activation behavior is unchanged;
- D-3 preview-only remains disabled;
- travel/weigh-in internal-only remains internal/read-only.

## Internal matrix review export

Stage 16 adds UI-only copy/export actions behind the same flag:

- `Copy review summary`;
- `Copy review JSON`.

The fixture runner remains unchanged because export is a browser-only review convenience built from already-returned preview/rollout data. It does not call API, save matrix draft, assign it to an athlete, write DB/storage/telemetry, or change rollout policy.

Manual verification must cover:

- flag off: export UI is hidden with the matrix panel;
- flag on D-90: exported payload includes allowed primary rollout summary;
- flag on D-3: exported payload includes `preview_only`/blockers;
- travel/weigh-in: exported payload includes internal-only context;
- exported JSON/markdown does not include athlete name, email, phone, user id, athlete id, personal notes, or DB identifiers.

## Matrix pilot readiness checklist

Stage 17 adds a shared readiness checklist for matrix pilot decisions:

- `packages/shared/src/constructor-matrix-pilot-readiness.ts`.

The checklist reuses the same preview/rollout scenarios covered by this fixture pack and classifies them as:

- limited primary pilot candidates: far development, post-competition recovery, D-28/D-21/D-10/D-4 main-start windows;
- internal pilot candidates: travel day, weigh-in day;
- preview-only: D-3 main-start final activation, secondary close starts and competition day;
- blocked/needs-review: unknown or unsafe inputs.

The fixture runner still does not snapshot UI. Instead, `scripts/check-perform-constructor-core.mjs` validates readiness behavior:

- D-90 and post-competition are `ready_for_limited_primary_pilot`;
- D-28/D-21/D-10/D-4 main-start windows are `ready_for_limited_primary_pilot`;
- travel and weigh-in are `ready_for_internal_pilot`;
- D-3 and competition day remain `preview_only`;
- unknown/bad inputs return `blocked` or `needs_review`;
- readiness summary includes status, blockers, and checklist counts;
- readiness evaluation does not mutate input.

Stage 17 does not add endpoint/UI behavior, write DB/storage/telemetry, save or assign matrix drafts, or change rollout policy.

## Pilot readiness in internal UI

Stage 18 renders the Stage 17 readiness result in the internal matrix UI:

- status badge;
- scenario / rollout mode / recommended action;
- checklist counts;
- blockers;
- collapsed checklist details;
- trainer/QA meaning text.

The UI is behind the same flag:

```bash
NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=true
```

The fixture runner remains data-safety oriented and does not snapshot React UI. Browser smoke must cover:

- flag off: matrix/readiness UI hidden;
- flag on: readiness card visible after preview/rollout;
- D-90 and post-competition show limited-primary readiness;
- travel/weigh-in show internal readiness;
- D-3 remains preview-only and activation stays disabled;
- review export includes safe readiness summary and no PII/raw evidence.

Stage 18 does not add an endpoint, write DB/storage/telemetry, save or assign matrix drafts, or change rollout policy.

## Limited primary pilot switch

Stage 19 adds a UI-only action behind two flags:

```bash
NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=true
NEXT_PUBLIC_MATRIX_CONSTRUCTOR_LIMITED_PRIMARY_PILOT=true
```

Fixture expectations still come from shared rollout/readiness logic. Browser
smoke must additionally cover:

- flag off: matrix UI hidden and no primary pilot action;
- internal UI on + pilot flag off: Stage 18 behavior remains, primary pilot
  action hidden;
- both flags on: eligible far-development/post-competition scenario can show
  the explicit `Use matrix as primary pilot draft` action;
- D-3/close-main-start preview-only scenarios do not expose an enabled primary
  pilot action;
- travel/weigh-in remain internal-only and do not become primary;
- returning to legacy still works;
- save/template/assign remain disabled for `matrix_primary_pilot`.

The pilot helper must not store state, send telemetry, write DB, or change the
production constructor draft route.

## Pilot-safe save dry-run

Stage 20 adds a dry-run check for `matrix_primary_pilot`. This is UI/internal
validation only.

Browser smoke should cover:

- both flags off: no dry-run UI;
- internal UI on + pilot flag off: no dry-run UI;
- both flags on before activation: dry-run status is `waiting`;
- both flags on after activating `matrix_primary_pilot`: dry-run can show
  `passed` for eligible D-90/post-competition payloads;
- D-3/travel/weigh-in remain unable to activate primary pilot, so dry-run does
  not become passed through those flows;
- real save/template/assign remains disabled for `matrix_primary_pilot`.

## Server-side pilot save dry-run

Stage 21 adds an internal API dry-run for the same primary pilot save-readiness
check:

```text
POST /api/v1/plans/constructor/internal/matrix-primary-pilot-save-dry-run
```

Smoke expectations:

- shared dry-run helper is used by both web and API;
- D-90 allowlisted primary fixture returns `dryRun.status = passed`;
- D-3 fixture returns `dryRun.status = blocked`;
- travel and weigh-in fixtures return `dryRun.status = blocked`;
- response contains rollout decision and pilot readiness evidence;
- response does not contain a template id or assigned plan id;
- no DB/API production save route is called;
- production constructor draft remains legacy.

## Internal UI server evidence

Stage 22 adds UI visibility for the server dry-run evidence:

- both flags off: no matrix UI and no server dry-run request;
- internal UI on + limited pilot off: matrix preview works, but no server dry-run
  request is made;
- both flags on: matrix preview requests server dry-run evidence;
- primary pilot panel shows local dry-run plus server dry-run;
- server error is displayed as review evidence and does not enable save;
- save/template/assign remains disabled for `matrix_primary_pilot`.

Dry-run validates a generated `PlanTemplatePayload` candidate but does not save
or expose the payload to save handlers.

## Primary pilot server activation gate

Stage 23 requires server evidence before the internal workspace can activate the
read-only `matrix_primary_pilot` view:

- flag off: matrix UI remains hidden and legacy flow is unchanged;
- internal UI on + limited pilot off: preview works, but primary pilot stays
  unavailable;
- both flags on + D-90 allowlisted scenario: server dry-run passes and the
  activation button can become available;
- D-3 preview-only: server rollout/readiness evidence blocks activation;
- travel/weigh-in: server evidence keeps the scenario internal-only;
- server error or missing response: activation is disabled with a visible
  reason;
- save/template/assign remains disabled for `matrix_primary_pilot`.

The fixture smoke should verify the server dry-run request is made only when the
limited pilot flag is enabled and that no matrix draft is persisted.

## Automated server gate regression

Stage 24 adds `npm run check:constructor-matrix-ui-gates`.

The check uses the fixture pack to verify:

- `far_development_week_d90` can pass the server gate;
- `main_start_d28_special_pre_competition`, `main_start_d21_controlled_volume`,
  `main_start_d10_taper` and `main_start_d4_start_window` can pass the server gate;
- `main_start_d3_final_activation` remains preview-only;
- `travel_day` and `weigh_in_day` remain internal-only;
- missing server evidence, server errors, and server rollout/readiness mismatch
  all block primary pilot activation.

This gives the fixture pack an explicit UI-gate regression layer without
snapshotting the full rendered draft.

## Read-only source persistence guard

Stage 25 extends `npm run check:constructor-matrix-ui-gates` with source-level
save rules:

- `legacy` must stay save-capable;
- `matrix_internal` must stay read-only;
- `matrix_primary_pilot` must stay read-only.

The check is intentionally small: it protects the constructor draft source
contract without adding browser snapshots or enabling any persistence path for
matrix candidates.

## Controlled exposure/default guard

Stage 26 extends the same check with exposure invariants:

- internal matrix UI defaults to hidden;
- limited primary pilot requires both explicit env flags;
- matrix preview/workspace/activation remains flag-gated;
- matrix state is not stored in browser storage;
- production constructor draft route remains legacy-backed;
- internal matrix endpoints remain guarded.

This keeps the fixture pack focused on pilot safety instead of full visual
snapshots: D-90 and the covered D-28/D-21/D-10 main-start windows can pass the
controlled primary gate, while D-3, travel and weigh-in stay
preview-only/internal-only according to their rollout decision.

## Review export evidence regression

Stage 27 adds `npm run check:constructor-matrix-review-export`.

The check builds anonymized export packages for:

- `far_development_week_d90`;
- `main_start_d3_final_activation`;
- `travel_day`;
- `weigh_in_day`.

It validates the copied review package, not the full UI:

- rollout mode/scenario/action;
- pilot readiness status and `matrixPrimaryAllowed`;
- matrix week/day/session/block counts;
- markdown and JSON shape;
- privacy marker;
- no athlete name, athlete id, coach note, raw season/plan ids, email-like,
  phone-like or UUID-like values.

This gives the manual pilot review path its own fixture coverage while keeping
the production constructor route unchanged.

## Threshold candidate metadata regression

The Threshold Candidate Registry is checked separately from preview fixtures:

Stage: Threshold Candidate Registry.

```bash
npm run check:constructor-matrix-threshold-candidates
```

This registry is candidate-only metadata. It documents possible future review
signals for weight cut, hydration, readiness, wearable data, sleep/RHR/HRV,
pain/injury, female/RED-S, youth, travel fatigue, competition context, contact
load, LMV and taper.

## Threshold Candidate Registry coverage patch

The coverage patch expands the metadata registry from 12 to 24 candidates and
requires all 16 areas to be present:

- weight cut, hydration, readiness, wearable data, sleep, RHR, HRV;
- pain, injury, female context/RED-S, youth context;
- travel fatigue, competition context, contact load, LMV and taper.

The patch now uses the exact threshold candidate contract from the stage spec:
`kind`, `whyNeeded`, `candidateStatement`, evidence/data ids, `requiredFields`,
`proposedRuntimeUse`, `status`, `reviewRequired`, `futureTargetLayers` and
`fixtureImpact`. It does not change fixture expectations.

## Matrix Review Package regression

`npm run check:constructor-matrix-review-package` builds the metadata-only
Matrix Review Package from the evidence, data dependency and threshold
candidate registries.

The review package is not a preview fixture and does not change fixture
expectations. It verifies:

- coach, medical and data-quality queues exist;
- every threshold candidate appears in a reviewer queue;
- every data/evidence reference resolves;
- JSON/Markdown output contains no athlete identity, email, phone-like value or
  UUID-like raw id;
- runtime constructor files do not import the review package.

Fixture behavior is unchanged:

- no numeric thresholds or cutoffs are added;
- no preview scenario becomes allowed because of a threshold candidate;
- no matrix draft is saved or assigned by this metadata;
- D-90, D-3, travel and weigh-in fixture behavior remains controlled by the
  existing Matrix rollout/readiness policy.

## Matrix Review Decision Ledger regression

Stage: Matrix Review Decision Ledger.

`npm run check:constructor-matrix-review-decision-ledger` verifies the
metadata-only ledger after the review package:

- all threshold candidates are covered;
- high-risk data dependencies are covered;
- evidence dependencies needing review are covered;
- every entry has `humanReviewed=false`;
- no `reviewedBy` or `reviewedAt` fields are present;
- no runtime constructor, API or web file imports the ledger.

Preview fixture expectations are unchanged:

- the ledger does not alter Matrix preview behavior;
- no preview scenario becomes primary because of a ledger status;
- no numeric thresholds or cutoffs are added;
- no Matrix default, save, template or assign path is enabled.

## Source Expansion Backlog + Review Intake Guard regression

Stage: Source Expansion Backlog + Review Intake Guard.

`npm run check:constructor-matrix-source-expansion-backlog` verifies the
metadata-only source-expansion backlog:

- required backlog items are present;
- evidence, data, threshold and ledger ids resolve;
- Review Package includes source-expansion summary metadata;
- Review Decision Ledger keeps `humanReviewed=false`;
- no fake citations or numeric thresholds are added;
- runtime constructor files do not import the backlog.

Preview fixture expectations are unchanged:

- the backlog does not alter Matrix preview behavior;
- no preview scenario becomes primary because of source-expansion metadata;
- no rollout, save/template/assign or legacy fallback behavior is changed;
- Matrix default remains prohibited.

## P0 Source Acquisition Dossier + Source Candidate Registry regression

Stage: P0 Source Acquisition Dossier + Source Candidate Registry.

`npm run check:constructor-matrix-source-candidates` verifies the
metadata-only source candidate registry:

- every P0 source-expansion backlog item has at least one source candidate;
- required source-acquisition areas are covered;
- evidence, data, threshold, ledger and backlog ids resolve;
- Review Package includes source-acquisition summary metadata;
- Review Decision Ledger keeps source-candidate links as metadata only;
- no fake citations, numeric thresholds or fake human approvals are added;
- runtime constructor files do not import the source-candidate registry.

Preview fixture expectations are unchanged:

- source candidates do not alter Matrix preview behavior;
- no preview scenario becomes primary because of source-candidate metadata;
- no rollout, save/template/assign or legacy fallback behavior is changed;
- broad Matrix default remains prohibited.

## P0 Controlled Source Lookup + Source Intake Registry regression

Stage: P0 Controlled Source Lookup + Source Intake Registry.

`npm run check:constructor-matrix-source-lookup-intake` verifies the
metadata-only source lookup intake registry:

- external lookup was available;
- source lookup intake records: 14;
- verified source identities: 14;
- manual verification needed: 2;
- extraction ready: 0;
- lookup unavailable: 0;
- P0 backlog coverage: 6/6;
- P0 source-candidate coverage: 10/10;
- source, backlog, evidence, data, threshold and ledger ids resolve;
- Review Package includes source lookup intake summary metadata;
- no fake citations, numeric thresholds or fake human approvals are added;
- runtime constructor files do not import the source lookup intake registry.

Preview fixture expectations are unchanged:

- source lookup intake metadata does not alter Matrix preview behavior;
- no preview scenario becomes primary because of source lookup metadata;
- no rollout, save/template/assign or legacy fallback behavior is changed;
- broad Matrix default remains prohibited;
- no source is promoted into runtime rules.

## P0 Evidence Claim Extraction Registry regression

Stage: P0 Evidence Claim Extraction Registry.

`npm run check:constructor-matrix-evidence-claims` verifies the metadata-only
claim registry and blockers:

- evidence claims: 0;
- evidence claim blockers: 20;
- source lookup records covered: 14/14;
- P0 source candidates covered: 10/10;
- P0 backlog items covered: 6/6;
- required high-risk areas are represented by blockers;
- manual-verification sources are not used for claims;
- runtime constructor files do not import the evidence-claim registry.

The claim registry intentionally empty because no source lookup intake record
is currently ready for claim extraction. Blockers carry the stage until full
text, policy text, source readiness or human review changes.

Preview fixture expectations are unchanged:

- evidence claim metadata does not alter Matrix preview behavior;
- no preview scenario becomes primary because of evidence claim metadata;
- no rollout, save/template/assign or legacy fallback behavior is changed;
- broad Matrix default remains prohibited;
- no source claim is promoted into runtime rules.

## Evidence Claim Blocker Review Intake Pack regression

Stage: Evidence Claim Blocker Review Intake Pack.

`npm run check:constructor-matrix-evidence-claim-review-intake` verifies the
metadata-only review intake pack for evidence claim blockers:

- every evidence claim blocker has exactly one review intake;
- manual-verification blockers require manual source verification before
  extraction;
- full-text/policy blockers require source text or official policy text before
  extraction;
- human-review blockers require real reviewer decisions before future
  extraction;
- high-risk blockers are routed to conservative coach, medical, data-quality,
  sport-science or product-safety tracks;
- `runtimeChangeAllowedNow=false` and `humanReviewed=false` remain unchanged.

Preview fixture expectations are unchanged:

- review intake metadata does not alter Matrix preview behavior;
- no preview scenario becomes primary because of review intake metadata;
- no rollout, save/template/assign or legacy fallback behavior is changed;
- broad Matrix default remains prohibited;
- no evidence claim is extracted, approved or promoted into runtime rules.

## Matrix Review Intake Export Pack regression

Stage: Matrix Review Intake Export Pack.

`npm run check:constructor-matrix-review-intake-export` verifies the
metadata-only export pack generated from Evidence Claim Review Intake:

- every review intake appears in at least one export item;
- every audience packet exists for manual source verification, source text
  acquisition, coach, medical, data-quality, sport-science and product-safety
  review;
- JSON and Markdown exports match the shared builder output;
- export items keep `runtimeChangeAllowedNow=false` and `humanReviewed=false`;
- no source readiness update, claim extraction or runtime promotion is
  performed.

Preview fixture expectations are unchanged:

- review intake export metadata does not alter Matrix preview behavior;
- no preview scenario becomes primary because of review intake export metadata;
- no rollout, save/template/assign or legacy fallback behavior is changed;
- broad Matrix default remains prohibited;
- no evidence claim is extracted, approved or promoted into runtime rules.

## Что не проверяется

Fixtures не делают full snapshot:

- не сравнивают весь draft JSON;
- не фиксируют точное число blocks/sessions, если это не invariant;
- не фиксируют весь русский текст explanation;
- не фиксируют весь список risk checks.

Это сделано намеренно, чтобы fixture pack ловил реальные regression-баги, но не ломался от нормальной редакции формулировок или объёмов.

## Safe-data rules

В fixtures запрещено добавлять:

- реальные имена спортсменов;
- даты рождения;
- контакты;
- production IDs;
- медицинские записи;
- данные часов;
- cookies;
- `.env`;
- browser profiles;
- dumps/logs с боевого сайта;
- любые персональные или чувствительные данные.

Использовать только synthetic IDs, synthetic athlete names и фиксированные тестовые даты.

## Как добавить новый fixture

1. Добавить сценарий в `constructorPreviewFixtures`.
2. Использовать synthetic `fixtureId`.
3. Описать только устойчивые expectations.
4. Не добавлять full snapshot.
5. Запустить:

```bash
npm run build --workspace @training-platform/shared
npm run check:constructor-core
npm run check
```

Если fixture падает, сначала проверить: это реальный regression или ожидание слишком жёсткое. Fixture должен закреплять тренерскую safety-логику, а не случайную текущую структуру draft.
