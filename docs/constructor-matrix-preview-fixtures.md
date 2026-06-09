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

Internal web preview panel использует тот же response shape через
`POST /api/v1/plans/constructor/internal/matrix-preview`. Поэтому fixture runner остаётся главным
автоматическим safety-слоем для данных, которые UI показывает как summary/safety/differences.

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
