# PERFORM Matrix Constructor: Evidence Dependency Gap Audit

Дата: 2026-06-11

Назначение: проверить, насколько текущий Matrix Constructor зависит от доказательной базы явно и проверяемо. Аудит не меняет логику конструктора, rollout policy, API, DB, mobile contracts или save/assign flow. Он фиксирует, где связь между методикой, кодом, тестами и доказательной базой уже сильная, а где остаётся gap перед расширением pilot.

## 1. Короткий вывод

Текущая Matrix-логика движется в правильном направлении: календарь старта, роль старта, оставшиеся дни, phase/week/day/session/block матрица, rollout gate, preview fixtures, server dry-run и feature flags уже отделяют безопасный пилот от production default.

Главный gap не в том, что Matrix "не имеет базы". База есть в документах и частично в коде. Главный gap в другом: доказательная зависимость пока не стала отдельным machine-checkable слоем.

Сейчас связь выглядит так:

```text
docs/evidence -> тренерская логика -> matrix rules -> fixtures -> rollout gate
```

А целевая связь должна стать такой:

```text
EvidenceDependency[]
-> phase/week/day/block rule
-> generated draft explanation
-> review export
-> pilot acceptance
```

Практический статус:

- internal/limited Matrix pilot можно продолжать под флагами;
- расширять Matrix как постоянный default для всех сценариев рано;
- следующий инженерный слой должен быть не "ещё один шаблон", а `EvidenceDependencyRegistry`.

## Stage: Matrix AI Internal Pilot Feedback + Resolver Hardening

AI-assisted internal pilot feedback found one resolver-quality issue: close-start
light technical blocks could surface body-composition candidate exercise names.
This was not evidence approval and not high-risk automation, but it could make
the coach-facing plan less clear near a start.

Hardening now applies:

- Matrix phase is passed into the exercise resolver;
- D28, D21, D10 and D4 close-start pilot drafts suppress body-composition
  exercise candidates;
- active weight-cut and `mat_light_technical` contexts suppress
  body-composition exercise candidates;
- long-horizon explicit body-composition content remains coach-editable and
  review-required;
- no human approval, no fake citation and no numeric medical or weight-cut
  runtime threshold was added.

## 2. Авторитетные источники текущего аудита

| Слой | Источник | Что проверялось |
|---|---|---|
| Методическая база | `docs/perform-cycle-builder-methodology.md` | уровни A/B/C, evidence types, требования к карточкам методик |
| Evidence matrix | `docs/perform-cycle-evidence-matrix.md` | рабочие методики, данные, риски, правила генератора |
| International evidence | `docs/perform-cycle-international-evidence.md` | NCAA, ACSM, NSCA, BFR/KAATSU, China SSIT/BFR, Japan RWL, judo transfer |
| Europe эталон | `docs/europe-2026-plan-analysis.md` | доказанный рабочий 23-дневный предсоревновательный план |
| Core stack | `docs/perform-constructor-core-stack.md` | требования к календарю, фазам, strategy snapshot, 0-4 day start window |
| Matrix transition | `docs/constructor-phase-matrix-transition-plan.md` | целевая phase/week/day/session/block матрица |
| Preview fixtures | `docs/constructor-matrix-preview-fixtures.md` | regression scenarios и controlled rollout checks |
| Matrix rules | `packages/shared/src/constructor-matrix.ts` | phase/week/day/block definitions, eligibility, compatibility cards |
| Matrix skeleton | `packages/shared/src/constructor-matrix-skeleton.ts` | day/week/session skeleton, travel, weigh-in, half-day, source compatibility |
| Matrix builder | `packages/shared/src/constructor-matrix-plan-builder.ts` | block selection, risk checks, volume rules |
| Matrix adapter | `packages/shared/src/constructor-matrix-adapter.ts` | conversion to normal constructor draft, evidenceRefs, template payload |
| Rollout gate | `packages/shared/src/constructor-matrix-rollout.ts` | allowlist/blockers/primary/internal/preview modes |
| Save dry-run | `packages/shared/src/constructor-matrix-save-dry-run.ts` | payload safety before template save/assign |

## 3. Статусы аудита

| Статус | Значение |
|---|---|
| `covered` | правило имеет документальную базу, кодовую реализацию и тест/rollout evidence |
| `partial` | правило есть, но связь с evidence или проверкой неполная |
| `gap` | правило зависит от предположения, тренерской логики или данных, но машинная связь не зафиксирована |
| `blocked-for-default` | нельзя делать production default, пока gap не закрыт |

## 4. Evidence Dependency Map

| ID | Matrix dependency | Evidence basis | Current code evidence | Test / rollout evidence | Status | Gap / required action |
|---|---|---|---|---|---|---|
| EDG-01 | Календарь старта задаёт точную длину плана, а не 7/14/21/30 шаблон | Core stack, transition plan, season strategy logic | `buildSeasonStrategySnapshot`, `applySeasonStrategyToConstructorInput`, `buildMatrixDrivenWeekSkeleton` | constructor core checks include 28/23/21/10/4-day scenarios | covered | Расширить fixtures на годовой календарь и multi-peak season, но базовое правило уже защищено. |
| EDG-02 | Главный старт <=30 дней запрещает `development` | Europe plan, taper logic, periodization, evidence matrix | phase rule `special_pre_competition`, forbiddenModes, matrix risk `main_start_development_forbidden` | D-28/D-21/D-10/D-4 fixtures and rollout | covered | Добавить typed evidence ids к phase rule, чтобы UI/export показывали основание не общим текстом. |
| EDG-03 | D-4...старт: короткая активация, вес, сон, без добора нагрузки | Europe plan, taper/peaking logic, ACSM/NCAA weight context | phase `competition`, day types `travel`, `weigh_in`, `competition`, block restrictions | D-4/D-3/competition fixtures, rollout preview-only/primary rules | covered | Нужно отдельное evidence dependency для "start window" в review export. |
| EDG-04 | Дорога и взвешивание снижают потолок нагрузки | Europe plan, ACSM hydration, NCAA weight management, Japan RWL | `isTravelDay`, `isWeighInDay`, travel/weigh_in block library, risk checks | travel/weigh-in fixtures, rollout internal-only | covered | Добавить количественные thresholds: travel fatigue, hydration/body mass change, sleep loss. |
| EDG-05 | После двух полных дней нужен half-day / разгрузка / смена обстановки | Europe plan + тренерская логика восстановления | `getSkeletonDayType` ставит half_day на среду/субботу в special/pre-competition weeks | core checks частично покрывают half-day density | partial | Нужны explicit fixtures: "2 full days -> half_day", "half_day без ковра", "environment_change вместо ковра при накоплении". |
| EDG-06 | Старые template cards не управляют структурой, только дают content/library trace | transition plan | `CONSTRUCTOR_TEMPLATE_CARD_COMPATIBILITY.controlsGeneration=false`, `legacyCards.usedAsStructure=false` | preview fixtures and rollout blocker `legacy_template_used_as_structure` | covered | Хорошо защищено. Следующий шаг: убрать слово legacy из trainer-facing UI уже начат, но evidence trace оставить внутренним. |
| EDG-07 | ЛМВ ног перед главным стартом не должна быть развитием | Evidence matrix, BFR/KAATSU, China BFR/half squat, Europe plan | `leg_lmv` allowed only far enough; `spp` covers support/transfer | D-28/D-21 fixtures forbid development-heavy blocks | partial | Сейчас heavy `leg_lmv` блок фактически запрещён <=30. Если нужен короткий поддерживающий локальный блок без отказа, нужен отдельный `leg_lmv_maintenance` с evidence ids and limits. |
| EDG-08 | Резкость первого действия ближе к старту = активация, не развитие скорости | Europe plan, speed/transfer logic | `first_action_speed.developsQuality=false`, minDaysUntilStartForMainStart=5, low load | D-10/D-4 fixtures allow light activation | covered | Добавить UI text/evidence dependency: "поддержание резкости", не "скорость как цель развития". |
| EDG-09 | Соревновательная модель допустима только до подводки и требует восстановления | Europe plan, UWW structure, wrestling temporal studies | `mat_competition_model`, `mat_control_bouts`, min days 10/14, forbidden combinations | D-28/D-21 allowed; D-10/D-4 constrained | partial | Нужны typed bout structure fields: periods, pauses, contact intensity, "3 мин + 30 сек + 3 мин" as model, not text. |
| EDG-10 | Weight-cut risk должен менять решение конструктора | NCAA/ACSM, Japan RWL, Sichuan wrestler study, RED-S context | riskTags `weight_gap`, sauna/weigh_in blocks, legacy risk flags | save dry-run protects payload, but not quantitative weight logic | gap | Нет единого numeric threshold layer для weight change, hydration, RHR/sleep combination. Нельзя расширять default weight-sensitive planning без него. |
| EDG-11 | Readiness/sleep/RHR/device data должны менять уверенность и нагрузку | recovery consensus, wearable validity, evidence matrix | adapter marks missing data and confidence; legacy core uses state more broadly | missing readiness fixture exists; pilot readiness checks exist | partial | Matrix skeleton/block selection пока слабо использует readiness as dependency. Нужен data-dependency gate: missing/low confidence -> restrict load and lower primary eligibility. |
| EDG-12 | Wearable data is trend evidence, not absolute truth | evidence matrix wearable validity row | review/export avoids PII; watch data handled elsewhere | no direct Matrix-specific wearable validity fixture | gap | Добавить `dataConfidence` dependency into Matrix rollout/readiness before using watch-derived recovery decisions. |
| EDG-13 | Save/template/assign Matrix draft only after safety evidence | rollout doc, save dry-run design | `buildMatrixPrimaryPilotSaveDryRun`, server gate evidence | UI gates, review export, production rollout checks | covered | Это operational safety, not methodology evidence. It protects pilot save but does not prove coaching quality. |
| EDG-14 | Every selected Matrix block should carry evidence refs into coach-readable explanation | methodology/evidence matrix require "Почему так" | adapter adds generic `evidenceRefs` like "PERFORM Evidence Matrix" | no per-block evidence-id check | gap | Add `evidenceDependencies` to phase/week/day/block definitions and require at least one typed dependency per selected block. |
| EDG-15 | Review export should explain evidence without leaking identity | review export stage, rollout doc | `constructor-matrix-review-export.ts` excludes PII | `check-constructor-matrix-review-export` | covered | Add evidence dependency summary to export once registry exists. |
| EDG-16 | Year / Olympic cycle / season strategy should constrain constructor | core stack, user-approved season strategy model | `SeasonStrategySnapshot`, `competitionRole`, currentWindow rules | core checks include season snapshot D-28 case | partial | Need fixtures for annual multi-peak calendar, secondary peak, qualifier, control start, and "next start after current start". |

## 5. Main gaps by severity

### P0 before broad production default

1. `EvidenceDependencyRegistry` отсутствует.
   - Сейчас evidence exists in docs, but code rules do not point to normalized ids.
   - Required: every phase/week/day/block/risk rule gets `evidenceDependencies`.

2. Нет machine check that every selected Matrix block has evidence.
   - Required: script/test fails if a matrix block, phase rule or risk rule has no evidence dependency.

3. Weight-cut/readiness thresholds are not first-class Matrix dependencies.
   - Required: numeric and contextual gates for weight change, sleep, RHR, readiness, pain and device confidence.

4. Matrix should not become default outside allowlist until P0 is closed.
   - Current allowlist pilot is acceptable; broad default is not.

### P1 for stronger pilot

1. Add fixtures for annual season strategy:
   - multi-peak season;
   - secondary start;
   - qualifier;
   - control start;
   - next competition after current competition.

2. Add fixtures for recovery rhythm:
   - two full days -> half-day;
   - half-day cannot become second mat session;
   - environment change day after accumulated mat density.

3. Split `leg_lmv`:
   - `leg_lmv_development`;
   - `leg_lmv_maintenance`;
   - `leg_lmv_activation` only if explicitly approved and low load.

4. Add bout-model structured fields:
   - periods;
   - pause;
   - bout count;
   - contact intensity;
   - quality goal.

### P2 after pilot acceptance

1. Show evidence level/type in internal review export.
2. Add coach feedback checklist per review export.
3. Add internal validation evidence from real PERFORM plans:
   - accepted / rejected;
   - edited by coach;
   - athlete response after assignment;
   - readiness/load outcome.

## 6. What is already safe to keep

These parts have enough evidence plus operational guards for controlled pilot:

- Matrix UI behind explicit feature flags.
- Preview/workspace/review export as internal tools.
- D-28/D-21/D-10/D-4 limited primary candidates under server evidence and dry-run.
- D-3 and competition day as preview-only.
- Travel/weigh-in as internal-only.
- Legacy/default route remaining safe fallback.
- Save/template/assign disabled unless all pilot gates pass.

## 7. What should not be done yet

- Do not make Matrix the always-on default constructor.
- Do not remove safe-plan fallback.
- Do not let old template cards control Matrix structure again.
- Do not let weight-sensitive plans rely only on generic `weight_gap`.
- Do not present wearable-derived recovery conclusions as high-confidence without data quality checks.
- Do not treat "PERFORM Evidence Matrix" as sufficient evidence label for every block; it is too generic for auditability.

## 8. Recommended next implementation stage

Stage after this audit should be:

```text
Add typed EvidenceDependencyRegistry for Matrix Constructor
```

Minimum shape:

```ts
type EvidenceDependency = {
  id: string;
  level: "A" | "B" | "C" | "A/B" | "B/C" | "A/B/C";
  type:
    | "direct_training_intervention"
    | "position_stand"
    | "sport_policy"
    | "transfer_grappling_evidence"
    | "coach_school"
    | "internal_validation";
  title: string;
  sourceDoc: string;
  supports: string[];
  limitations: string[];
};
```

Then extend:

```text
ConstructorPhaseMatrixRule.evidenceDependencies
ConstructorWeekMatrixRule.evidenceDependencies
ConstructorDayMatrixRule.evidenceDependencies
ConstructorTrainingBlockDefinition.evidenceDependencies
MatrixDrivenRiskCheckResult.evidenceDependencies
```

And add a check:

```text
npm run check:constructor-matrix-evidence-dependencies
```

The check should verify:

- every matrix phase/week/day/block rule has at least one evidence dependency;
- every selected block in preview fixtures exposes evidence dependencies;
- every dependency id exists in the registry;
- no rule claims a higher evidence level than its source supports;
- high-risk areas such as weight cut, travel, weigh-in, close main start and wearable readiness have explicit limitations.

## 9. Audit decision

Current decision:

```text
Status: proceed with controlled Matrix pilot, do not broaden default.
Reason: safety gates and rollout checks are strong; evidence traceability is not yet machine-checkable.
Primary gap: evidence dependency registry + data-quality thresholds.
Next step: implement typed evidence dependencies before broad production expansion.
```

## 10. Registry implementation status

Implemented after this audit:

- typed registry: `packages/shared/src/constructor-matrix-evidence.ts`;
- exported registry ids and helpers from `@training-platform/shared`;
- `evidenceDependencies` attached to:
  - `ConstructorPhaseMatrixRule`;
  - `ConstructorWeekMatrixRule`;
  - `ConstructorDayMatrixRule`;
  - `ConstructorTrainingBlockDefinition`;
  - selected Matrix blocks;
  - Matrix risk checks;
  - block eligibility reasons;
- Matrix adapter now carries registry titles into `ConstructorPlanBlock.evidenceRefs`;
- automated check:

```bash
npm run check:constructor-matrix-evidence-dependencies
```

The check verifies:

- registry ids are unique and point to existing docs;
- every phase/week/day/block Matrix rule has evidence dependencies;
- high-risk domains expose explicit limitations;
- every selected block in preview fixtures carries evidence dependencies;
- every risk check in preview fixtures carries evidence dependencies.

Remaining P0 gap after registry:

- numeric thresholds for weight cut, hydration, readiness, RHR, sleep, pain and device confidence still need a separate data-dependency gate before Matrix becomes broad default.

## 11. Registry hardening status

Stage: Registry Hardening + Data Dependency Gate Skeleton.

Implemented after the first registry pass:

- `EvidenceDependencyRegistry` is now audit-ready metadata, not just a list of source titles;
- every evidence dependency carries:
  - `riskAreas`;
  - `auditRefs`;
  - `automationReadiness`;
  - `reviewStatus`;
  - `ruleNature`;
- high-risk dependencies such as weight cut, hydration, readiness, wearable data, travel, weigh-in, competition day, LМВ, BFR/KAATSU, contact load, taper, youth/female context and injury/pain must expose explicit limitations;
- internal validation, coach-school evidence and the Europe 2026 plan are not allowed to become universal hard rules;
- product rollout guards are treated as operational safety, not sport-science proof;
- generic evidence ids cannot be the only evidence basis for a Matrix block.

Added metadata-only data dependency skeleton:

- `packages/shared/src/constructor-matrix-data-dependencies.ts`;
- `npm run check:constructor-matrix-data-dependencies`;
- areas covered: weight cut, hydration, readiness, wearable data, sleep, RHR, HRV, pain, injury, female context, youth context, travel fatigue, competition context, contact load, LMV and taper;
- each item records required/optional fields, current availability, missing-data behavior, evidence links, limitations and current runtime use.

Guardrails:

- no numeric thresholds were added;
- no runtime decision rule was added;
- production `/api/v1/plans/constructor/draft` was not changed;
- rollout gates, preview behavior, pilot readiness, save/template/assign and legacy fallback were not changed;
- Matrix broad default remains blocked until data confidence and threshold candidates are reviewed separately.

Remaining P0 after hardening:

- numeric thresholds/data confidence are still not runtime gates;
- next stage should be a Threshold Candidate Registry as docs/metadata first, with coach/medical review before any runtime use.

## 12. Threshold Candidate Registry status

Stage: Threshold Candidate Registry.

Implemented after the data-dependency skeleton:

- metadata-only registry:
  `packages/shared/src/constructor-matrix-threshold-candidates.ts`;
- automated check:

```bash
npm run check:constructor-matrix-threshold-candidates
```

- candidate-only records for weight cut, hydration, readiness, wearable data,
  sleep, RHR, HRV, pain, injury, female context/RED-S, youth context, travel
  fatigue, competition context, contact load, LMV and taper;
- every candidate links to existing data dependencies and evidence
  dependencies;
- high-risk areas stay coach/medical review-required or blocked for runtime.

Guardrails:

- no numeric thresholds or cutoffs were added;
- no runtime gate was added;
- no production draft route, rollout policy, preview behavior,
  save/template/assign flow or legacy fallback was changed;
- current use remains documentation, review queue or future-candidate metadata
  only.

Remaining P0:

- coach, medical and data-quality validation must happen before any candidate
  can move toward a runtime decision rule;
- threshold candidates are not proof and cannot override the Matrix safety
  policy.

## 13. Threshold Candidate Registry coverage patch

Stage: Threshold Candidate Registry Coverage Patch.

Coverage was audited after the initial registry stage. The registry originally
contained 12 candidate-only records and did not cover HRV, contact load, LMV or
taper. The patch closes those metadata gaps without changing runtime behavior.

Current coverage:

- candidate count: 24;
- required areas covered: weight cut, hydration, readiness, wearable data,
  sleep, RHR, HRV, pain, injury, female context/RED-S, youth context, travel
  fatigue, competition context, contact load, LMV and taper;
- added data dependency metadata for HRV trend, wrestling contact-load
  exposure, leg LMV local fatigue and taper hidden-fatigue context;
- required candidate ids include acute body mass loss, weight descent rate,
  hydration status, sauna/heat exposure, sleep confidence, RHR deviation, HRV
  trend, wearable data quality, multi-signal readiness, pain location/severity,
  injury return, female symptom context, RED-S risk, youth progression/weight
  cut, travel fatigue, competition day, contact exposure, control bouts, LMV
  recovery/near-start role, taper SFP and hidden glycolytic close-start load.

Each candidate records:

- `id`, `area`, `kind`, `title`, `whyNeeded`, `candidateStatement`;
- `evidenceDependencyIds`, `dataDependencyIds`, `requiredFields`;
- `missingDataBehavior`, `proposedRuntimeUse`, `status`, `reviewRequired`;
- `limitations`, `forbiddenRuntimeUseNow`, `futureTargetLayers`;
- `fixtureImpact.runtimeChangeAllowedNow=false`.

Validation now explicitly checks:

- minimum candidate count;
- required area coverage;
- valid data dependency ids;
- valid evidence dependency ids;
- metadata-only fixture impact;
- no runtime imports from Matrix decision files;
- no numeric threshold values.

Guardrails unchanged:

- no production draft route changes;
- no rollout gate changes;
- no preview behavior changes;
- no legacy fallback changes;
- no runtime hard gates or numeric cutoffs.

## 14. Matrix Review Package

Stage: coach/medical/data-quality review package.

The Matrix Review Package turns the evidence, data dependency and threshold
candidate registries into one manual review artifact before any runtime
promotion is considered.

Implemented artifact:

- `packages/shared/src/constructor-matrix-review-package.ts`;
- `npm run check:constructor-matrix-review-package`;
- JSON and Markdown package built from:
  - `EvidenceDependencyRegistry`;
  - `CONSTRUCTOR_MATRIX_DATA_DEPENDENCIES`;
  - `CONSTRUCTOR_MATRIX_THRESHOLD_CANDIDATES`.

Reviewer queues:

- coach review: coaching fit, wrestling specificity, taper/contact/LMV
  interpretation and whether a candidate belongs in review notes only;
- medical review: weight cut, hydration, RED-S/female context, injury return,
  youth protection and any medical-safety wording;
- data-quality review: required fields, wearable confidence, missing-data
  behavior and auditability without athlete identity.

Guardrails:

- no runtime behavior changes;
- no production route changes;
- no rollout/preview/legacy fallback changes;
- no numeric threshold values;
- runtime Matrix decision files must not import the review package.

## 15. Matrix Review Decision Ledger

Stage: Matrix Review Decision Ledger.

The Matrix Review Decision Ledger completes the metadata governance chain:

EvidenceDependencyRegistry -> DataDependencyGate -> ThresholdCandidateRegistry
-> ReviewPackage -> ReviewDecisionLedger.

Implemented artifact:

- `packages/shared/src/constructor-matrix-review-decision-ledger.ts`;
- `npm run check:constructor-matrix-review-decision-ledger`;
- shared exports for ledger ids, subject lookups and summary helpers.

Ledger scope:

- all threshold candidates have ledger entries;
- all high-risk data dependencies have ledger entries;
- evidence dependencies needing review have ledger entries;
- review package output includes a ledger summary.

Guardrails:

- no human approvals are recorded;
- entries are system initial triage, audit trace or review-package queue
  metadata;
- `humanReviewed=false` for every entry;
- no `reviewedBy` or `reviewedAt` fields are allowed;
- no numeric thresholds or cutoffs are added;
- runtime behavior, production route, rollout gates, preview behavior and
  legacy fallback are unchanged;
- Matrix default remains disabled.

Next step: run an actual coach, medical and data-quality review pass, or move
source gaps into a source-expansion backlog before any runtime promotion.

## 16. Source Expansion Backlog + Review Intake Guard

Stage: Source Expansion Backlog + Review Intake Guard.

The source-expansion backlog converts the Review Package and Review Decision
Ledger into a prioritized intake list for future review work. It is
metadata-only and does not claim that new sources have been found.

Implemented artifact:

- `packages/shared/src/constructor-matrix-source-expansion-backlog.ts`;
- `npm run check:constructor-matrix-source-expansion-backlog`;
- shared exports for backlog ids, lookup helpers and backlog summary;
- Review Package summary fields for backlog count, priority counts, review
  tracks and unresolved P0 backlog ids;
- Review Decision Ledger metadata links to related backlog items.

Guardrails:

- no sources, citations, authors, years, DOI or PMID values are invented;
- no numeric threshold values are approved;
- no human review decisions are faked;
- `humanReviewed=false` remains unchanged in the Review Decision Ledger;
- runtime behavior, production route, rollout gates, preview behavior and
  legacy fallback are unchanged;
- Matrix default remains prohibited.

Next step: actual coach, medical, data-quality and sport-science review, or
targeted source acquisition for the P0/P1 backlog items.

## 17. P0 Source Acquisition Dossier + Source Candidate Registry

Stage: P0 Source Acquisition Dossier + Source Candidate Registry.

The source-candidate registry adds a metadata-only intake layer after the
Source Expansion Backlog:

SourceExpansionBacklog -> SourceCandidateRegistry -> P0 Source Acquisition
Dossier.

Implemented artifact:

- `packages/shared/src/constructor-matrix-source-candidates.ts`;
- `docs/constructor-matrix-source-acquisition-p0-dossier.md`;
- `npm run check:constructor-matrix-source-candidates`;
- shared exports for source candidate ids, lookup helpers and acquisition
  summary;
- Review Package source-acquisition summary metadata;
- Review Decision Ledger metadata links to source candidate ids.

Scope:

- every P0 source-expansion backlog item has at least one source candidate;
- required areas are covered for source-acquisition planning;
- candidates link to existing evidence, data, threshold, ledger and backlog ids;
- candidates remain `needs_external_lookup`, `mentioned_in_existing_docs` or
  `requires_verification`.

Guardrails:

- no source is automatically accepted;
- no fake citations, DOI, PMID, authors or bibliographic claims are added;
- no numeric thresholds or cutoffs are added;
- no fake human approvals, reviewer names or review timestamps are added;
- `runtimeChangeAllowedNow=false` for every source candidate;
- runtime behavior, production route, rollout gates, preview behavior and
  legacy fallback are unchanged;
- broad Matrix default remains blocked.

Next step: controlled external lookup, evidence claim extraction, real
coach/medical/data-quality review or a future source-candidate acceptance
ledger.

## 18. P0 Controlled Source Lookup + Source Intake Registry

Stage: P0 Controlled Source Lookup + Source Intake Registry.

The source lookup intake registry adds a controlled metadata-only layer after
the Source Candidate Registry:

SourceExpansionBacklog -> SourceCandidateRegistry -> SourceLookupIntake ->
future EvidenceClaimExtraction.

Implemented artifact:

- `packages/shared/src/constructor-matrix-source-lookup-intake.ts`;
- `npm run check:constructor-matrix-source-lookup-intake`;
- shared exports for source lookup ids, lookup helpers and intake summary;
- Review Package source-lookup summary metadata;
- Review Decision Ledger metadata links to source lookup intake ids.

Lookup status:

- external lookup was available;
- source lookup intake records: 14;
- verified source identities: 14;
- manual verification needed: 2;
- extraction ready: 0;
- lookup unavailable: 0;
- P0 source-expansion backlog coverage: 6/6;
- P0 source-candidate coverage: 10/10.

Guardrails:

- the registry stores citation/source-identity metadata only;
- no source is accepted into runtime rules;
- no evidence claims are extracted in this stage;
- no numeric threshold values or cutoffs are approved;
- no fake citations, DOI, PMID, authors or years are added;
- no fake human approvals, reviewer names or review timestamps are recorded;
- runtime behavior, production route, rollout gates, preview behavior and
  legacy fallback are unchanged;
- Matrix default remains prohibited.

Next step: evidence claim extraction from verified sources only, or manual
source verification for entries marked as needing manual verification.

## 19. P0 Evidence Claim Extraction Registry

Stage: P0 Evidence Claim Extraction Registry.

The Evidence Claim Extraction Registry adds a metadata-only layer after
SourceLookupIntake. It is designed to hold extracted source claims only when a
source lookup record is verified and extraction-safe.

Current result:

- `packages/shared/src/constructor-matrix-evidence-claims.ts`;
- `npm run check:constructor-matrix-evidence-claims`;
- evidence claims: 0;
- evidence claim blockers: 20;
- source lookup records covered: 14/14;
- P0 source candidates covered: 10/10;
- P0 backlog items covered: 6/6;
- required high-risk areas covered by blockers.

The claim registry intentionally empty because the SourceLookupIntake stage
reported `extractionReadyCount=0`. Manual-verification sources are covered by
blockers, and verified-but-not-ready records remain blocked until full source
text, policy text or reviewer intake is complete.

Guardrails:

- evidence claims are metadata-only and are not runtime rules;
- claims are not human-approved;
- no numeric thresholds or cutoffs are introduced;
- no fake citations, source metadata or human approvals are added;
- runtime behavior, production route, rollout gates, preview behavior and
  legacy fallback are unchanged;
- Matrix default remains disabled.

Next step: human review of claim blockers, manual verification of policy/rule
sources, or a later evidence-claim extraction pass after source readiness is
updated.

## 20. Evidence Claim Blocker Review Intake Pack

Stage: Evidence Claim Blocker Review Intake Pack.

The Review Intake Pack adds a metadata-only layer after
EvidenceClaimBlockers:

EvidenceClaimBlocker -> ReviewIntake -> reviewer questions -> required
artifacts -> allowed outcomes -> future manual review.

Implemented:

- `packages/shared/src/constructor-matrix-evidence-claim-review-intake.ts`;
- `npm run check:constructor-matrix-evidence-claim-review-intake`;
- Review Package summary for review intake counts, statuses and tracks;
- one review intake route for every current evidence claim blocker.

Guardrails:

- the intake pack does not approve claims;
- it does not extract claims;
- it does not create numeric thresholds;
- it does not invent citations, source metadata or reviewer decisions;
- it keeps `humanReviewed=false` and records no `reviewedBy` or `reviewedAt`;
- runtime behavior, production route, rollout gates, preview behavior and
  legacy fallback are unchanged;
- Matrix default remains disabled.

Routing:

- manual-verification blockers require manual source verification before
  extraction;
- full-text/policy blockers require source text or official policy text before
  extraction;
- human-review blockers require real reviewer decisions before any future
  extraction pass;
- all blockers are routed to conservative coach, medical, data-quality,
  sport-science or product-safety tracks according to affected area.

Next step: actual human review, manual source verification outside code, or a
future extraction pass only after source readiness changes.

## 21. Matrix Review Intake Export Pack

Stage: Matrix Review Intake Export Pack.

The Review Intake Export Pack adds a metadata-only human-review export layer
after EvidenceClaimReviewIntake:

EvidenceClaimReviewIntake -> ReviewIntakeExportPack -> reviewer-specific
Markdown/JSON packets -> real-world manual review.

Implemented:

- `packages/shared/src/constructor-matrix-review-intake-export.ts`;
- `docs/matrix-review-intake-export/`;
- `npm run generate:constructor-matrix-review-intake-export`;
- `npm run check:constructor-matrix-review-intake-export`;
- Review Package summary for export item counts and audience counts.

Guardrails:

- export pack is metadata-only and for human reviewers;
- it does not approve anything;
- it does not extract claims;
- it does not update source readiness;
- it does not create numeric thresholds;
- it does not change runtime behavior, production route, rollout gates,
  preview behavior or legacy fallback;
- Matrix default remains disabled.

Next real-world step: manual source verification and reviewer completion
outside code. Next code stage after real review: Source Readiness Update from
Human Review Results.

## 22. Matrix Desk Source Review + Evidence Claim Candidate Extraction

Stage: Matrix Desk Source Review + Evidence Claim Candidate Extraction.

This stage adds a metadata-only AI/desk-review layer after SourceLookupIntake:

SourceLookupIntake -> DeskSourceReviewRegistry ->
EvidenceClaimCandidateRegistry -> future human review / source verification /
extraction pass.

Implemented:

- `packages/shared/src/constructor-matrix-desk-source-review.ts`;
- `packages/shared/src/constructor-matrix-evidence-claim-candidates.ts`;
- `npm run check:constructor-matrix-desk-source-review-and-claim-candidates`;
- Review Package summary fields for desk source reviews and claim candidates.

Guardrails:

- desk source review is not human review;
- claim candidates are not final evidence claims;
- claim candidates are not runtime rules;
- no human approvals, medical approvals or coach approvals were added;
- every desk review and claim candidate keeps `humanReviewed=false`;
- no `reviewedBy` or `reviewedAt` values were recorded;
- no numeric thresholds or cutoff values were added;
- no fake citations or fake source metadata were added;
- source readiness was not updated;
- manual-verification-needed sources remain blocked for final extraction;
- runtime behavior, production route, rollout gates, preview behavior and
  legacy fallback are unchanged;
- Matrix default remains disabled.

Current metadata shape: 14 desk source reviews cover the 14 source lookup
records, and 15 evidence-claim candidates exist as candidate-only review
context. `competition_context` remains blocked for future manual/regulatory
source verification rather than being converted into a final claim.

Next stage: real human/manual source review or Source Readiness Update from
Human Review Results.

## 23. Matrix Evidence Claim Candidate Review Export Pack

Stage: Matrix Evidence Claim Candidate Review Export Pack.

This stage adds a metadata-only export layer for the Evidence Claim Candidate
registry:

EvidenceClaimCandidateRegistry -> ClaimCandidateReviewExportPack ->
reviewer-specific Markdown/JSON packets -> real-world manual review.

Implemented:

- `packages/shared/src/constructor-matrix-evidence-claim-candidate-review-export.ts`;
- `docs/matrix-claim-candidate-review-export/`;
- `npm run generate:constructor-matrix-evidence-claim-candidate-review-export`;
- `npm run check:constructor-matrix-evidence-claim-candidate-review-export`;
- Review Package summary fields for claim candidate review export item counts
  and audience counts.

The export pack is metadata-only and for human reviewers. It exports
candidate-only claims, not final claims. It does not approve anything, does not
update source readiness, does not create numeric thresholds and does not change
runtime behavior.

Current export shape: 15 evidence claim candidates are covered by 80 export
items. Audience counts are coach 15, medical 15, data-quality 11,
sport-science 13, product-safety 11, manual source verification 0 and source
text acquisition 15. Final evidence claims remain 0.

Production route, rollout gates, preview behavior and legacy fallback are
unchanged. Matrix default remains disabled.

Next real-world step: manual source verification, full-text acquisition and
reviewer completion outside code. Next code stage after real review: Source
Readiness Update from Human Review Results.

## 24. Matrix Constructor Dependency Map

Stage: Matrix Constructor Dependency Map + Controlled Pilot Hardening Audit.

This stage adds a machine-readable dependency map and controlled-pilot
hardening audit without changing Matrix runtime behavior.

Implemented:

- `packages/shared/src/constructor-matrix-dependency-map.ts`;
- `scripts/check-constructor-matrix-dependency-map.mjs`;
- `docs/matrix-controlled-pilot-acceptance-matrix.md`;
- `npm run check:constructor-matrix-dependency-map`.

The audit validates runtime/source/AI governance boundaries, production draft
route safety, feature-flag defaults, no-write internal endpoints, Matrix
save/assign default blocking and pilot fixture coverage.

Current pilot boundaries:

- safe D90/D28/D21/D10/D4 pilot scenarios may use Matrix only after rollout,
  readiness and server dry-run evidence pass;
- D-3, travel, weigh-in and competition-day contexts fall back or remain
  preview-only when server dry-run blocks the pilot;
- female/RED-S, youth, pain, injury-return, weight-cut, hydration and
  BFR/KAATSU areas remain blocked, fallback-only or review-required;
- no numeric threshold gates, fake citations or fake human approvals are added;
- production route, rollout gates, preview behavior and legacy fallback remain
  unchanged.

## 25. Controlled Pilot End-to-End Validation

Stage: Controlled Pilot End-to-End Validation.

This stage validates the Matrix controlled pilot as a real plan-building path
and adds the Matrix Controlled Pilot Runbook.

Implemented:

- `scripts/check-constructor-matrix-controlled-pilot-e2e.mjs`;
- `docs/matrix-controlled-pilot-e2e-validation.md`;
- `docs/matrix-controlled-pilot-runbook.md`;
- `npm run check:constructor-matrix-controlled-pilot-e2e`.

The check builds D90, D28, D21, D10 and D4 Matrix pilot drafts through rollout,
readiness, dry-run and server gate evidence, then validates the weeks/days/
sessions/blocks shape and existing template/assignment payload compatibility.

D-3, travel, weigh-in and competition-day contexts remain fallback or
preview-only. High-risk medical, weight-cut, hydration, pain, injury, RED-S,
youth and BFR/KAATSU areas remain blocked, fallback-only or review-required.

The runbook keeps feature flags off by default, preserves legacy fallback,
keeps Matrix save/assign production writes disabled and documents feature-flag
rollback.

## 26. Matrix Save/Assign Controlled Pilot

Stage: Matrix Save/Assign Controlled Pilot.

This stage adds the controlled save/assign pilot guard without changing the
Matrix evidence governance layer.

Implemented:

- `scripts/check-constructor-matrix-save-assign-controlled-pilot.mjs`;
- `docs/matrix-save-assign-controlled-pilot.md`;
- `npm run check:constructor-matrix-save-assign-controlled-pilot`.

Evidence/governance impact:

- allowed D90, D28, D21, D10 and D4 pilot scenarios can produce
  save-compatible payloads only after rollout, readiness, local dry-run, server
  dry-run and server gate evidence pass;
- D-3, travel, weigh-in and competition-day scenarios remain fallback or
  blocked for Matrix save/assign;
- high-risk medical decisions remain non-automated and review-required;
- Matrix is not production default;
- no DB schema migration is required;
- no numeric threshold gates, fake citations or fake human approvals are added;
- no evidence/source/review metadata is persisted in template payloads.

## 27. Final Controlled Pilot Readiness

Stage: Final Controlled Pilot Readiness.

`docs/matrix-final-controlled-pilot-readiness.md` records the readiness
decision:

- Matrix is controlled-pilot ready only if all checks pass;
- legacy fallback remains default;
- Matrix is not production default;
- controlled save/assign remains feature-flagged and server-evidence gated;
- high-risk medical decisions remain non-automated;
- no DB schema migration, no numeric threshold runtime gates and no fake human
  approvals are added.
# Stage: Matrix Full Training Content Library

Matrix controlled pilot now includes a full-content layer tied back to the
existing evidence dependency registry. The exercise library, resolver, load
prescription, athlete-context requirement, nutrition guidance and
weight-management guidance registries use existing evidence dependency ids and
remain controlled-pilot metadata/content.

This stage adds no fake citations, no fake human approvals, no numeric medical
threshold gates and no unsafe rapid weight-cut automation. Nutrition guidance
is educational and not medical advice. Weight-management guidance is
review-required and non-automated.

## Stage: Matrix Full Content Controlled Pilot

Full-content pilot checks validate D90, D28, D21, D10 and D4 plans with
concrete exercises while confirming fallback for travel, weigh-in, competition
day and high-risk contexts. Matrix is not production default, the production
route `/api/v1/plans/constructor/draft` remains legacy-backed and high-risk
medical decisions remain non-automated.

## Stage: Matrix Exercise Evidence Map

The expanded Matrix content library now has a metadata-only evidence-family
map in `packages/shared/src/constructor-matrix-exercise-evidence-map.ts`.
Every exercise, nutrition guidance item and weight-management guidance item is
covered by at least one review family.

This closes an evidence-audit organization gap without claiming final source
approval. The map adds no citations, no human approvals, no numeric medical or
weight-cut thresholds and no runtime promotion.

## Stage: Matrix Exercise Source Requirements

The follow-on source requirement registry in
`packages/shared/src/constructor-matrix-exercise-source-requirements.ts`
defines source types, review questions, minimum acceptance criteria and
runtime-promotion blockers for every evidence family.

P0 requirements cover body-composition, nutrition/body-composition,
weight-management, weigh-in, high-risk weight-cut/hydration and BFR/KAATSU
blocked contexts. All requirements keep `runtimePromotionAllowedNow: false`.

## Stage: Matrix Family-Level Evidence Review + Coach UI + Controlled Pilot Readiness

The evidence-family map now has AI desk source-review metadata, P0/P1 family
evidence dossiers and family allowed-use checks.

This closes the next audit gap: Matrix can distinguish safe coach-editable
training families from high-risk families that must remain blocked,
fallback-only or review-required. The coach-facing UI can inspect Matrix plans,
exercise notes, editable-load status, risk flags and evidence refs, while
controlled pilot quality logging remains metadata-only and avoids PII.

No production route behavior, Matrix default, DB schema, rollout gate,
preview behavior or save/assign production path changes are introduced. No
fake citations, fake human approvals, medical approvals, coach approvals,
numeric medical thresholds or unsafe weight-cut automation are added.
