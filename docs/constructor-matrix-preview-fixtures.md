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

Internal/debug API endpoint, который использует тот же preview response helper:

```text
POST /api/v1/plans/constructor/internal/matrix-preview
```

Запуск:

```bash
npm run check:constructor-core
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

Текущий pack содержит 11 synthetic fixtures:

1. `main_start_d28_special_pre_competition`
2. `main_start_d21_controlled_volume`
3. `main_start_d10_taper`
4. `main_start_d3_final_activation`
5. `travel_day`
6. `weigh_in_day`
7. `competition_day`
8. `post_competition_day`
9. `secondary_start_d10`
10. `far_development_week_d90`
11. `missing_readiness_data`

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
- `main_start_d28` -> `scenario=main_start_d28_preview`, `mode=preview_only`;
- `main_start_d21` -> `scenario=main_start_d21_preview`, `mode=preview_only`;
- `main_start_d10` -> `scenario=main_start_d10_preview`, `mode=preview_only`;
- `main_start_d3` -> `scenario=main_start_d3_preview`, `mode=preview_only`;
- `competition_day` -> `scenario=competition_day_preview`, `mode=preview_only`;
- `unknown` -> `legacy_only` или `blocked` с явным blocker;
- `explicitly_disabled` -> `blocked`;
- `buildMatrixConstructorDraftIfAllowed` returns matrix only for primary-allowed far development and falls back/blocks close main-start scenarios;
- rollout decision не мутирует input;
- default `buildPerformConstructorDraft` остаётся legacy.

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
