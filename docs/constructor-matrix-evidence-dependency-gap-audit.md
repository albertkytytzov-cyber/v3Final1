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
