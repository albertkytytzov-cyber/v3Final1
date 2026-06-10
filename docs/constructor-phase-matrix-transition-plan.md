# PERFORM Constructor Phase Matrix Transition Plan

Версия: черновик v1, 2026-06-09

Назначение: зафиксировать переход конструктора подготовки от старой `template-driven` логики к новой `matrix-driven` логике, где календарь стартов и фаза подготовки определяют структуру недели, дня, утро/вечер, блоки, упражнения, объём, риски и объяснение.

На этом этапе бизнес-логика не меняется. Документ фиксирует карту текущей реализации, целевую матрицу, алгоритм, типы, план миграции и тесты. Большой рефакторинг конструктора можно делать только после утверждения этой схемы.

## 1. Текущая реализация

### 1.1 Где находится "голова" конструктора

| Что ищем | Файл / функция | Что делает сейчас |
| --- | --- | --- |
| Старт из календаря | `apps/web/app/page-client.tsx`, `selectedConstructorCompetitionPlan`, `selectedConstructorCompetition`, `handleConstructorCompetitionPlanChange` | Берёт выбранный старт из календаря спортсмена и подставляет данные в форму конструктора. |
| Ближайший старт | `apps/web/app/page-client.tsx`, `getNearestConstructorCompetitionPlan`, `useEffect` около выбора конструктора | Если у спортсмена есть будущие старты, автоматически выбирает ближайший старт, пока тренер не выбрал другой. |
| Дни до старта | `apps/web/app/page-client.tsx`, `diffDateInputDays(...)` внутри `buildConstructorInputFromForm` | Считает точные дни от текущей даты до даты соревнования. |
| Фаза по дням до старта | `apps/web/app/page-client.tsx`, `deriveConstructorPhaseByCompetitionDays` | `0-4` -> `start_window`, `5-14` -> `taper`, `15-30` -> `special_preparation`, `31-60` -> `development`, дальше `base`. |
| Длина draft-плана | `apps/web/app/page-client.tsx`, `deriveConstructorCycleLengthByCompetitionDays` | Если до старта `<=30`, длина равна точному количеству оставшихся дней. Если дальше, возвращает 30. |
| Сезон и олимпийский цикл | `apps/web/app/page-client.tsx`, `constructorSeasonStrategySnapshot = buildSeasonStrategySnapshot(...)` | Собирает стратегический снимок: сезон, олимпийский цикл, выбранный старт, календарь стартов. |
| Роль старта | `packages/shared/src/season-strategy.ts`, `competitionRoleForPlan` | Определяет роль старта: главный пик, второй пик, квалификация, контрольный старт. |
| Фаза с учетом роли и года цикла | `packages/shared/src/season-strategy.ts`, `phaseForTarget` | Для главного старта `<=30` переводит в `special_preparation` и запрещает развитие. |
| Запрет развития перед главным стартом | `packages/shared/src/season-strategy.ts`, `rulesForSnapshot` | Для `main_peak <=30` разрешает только `maintenance`, `transfer`, `activation`, `recovery`; запрещает `development`. |
| Применение стратегии сезона к input | `packages/shared/src/constructor-core.ts`, `applySeasonStrategyToConstructorInput` | Перезаписывает `context.currentPhase`, `cycleLengthDays`, mandatory/blocked focus по `SeasonStrategySnapshot`. |

Вывод: "голова" уже близка к правильной. Она понимает календарь, старт, дни, фазу, роль, сезон, олимпийский цикл и стратегические запреты.

### 1.2 Где сейчас собирается "тело" конструктора

| Что ищем | Файл / функция | Что делает сейчас |
| --- | --- | --- |
| Старые карточки шаблонов | `packages/shared/src/constructor-core.ts`, `CONSTRUCTOR_TEMPLATE_CARDS` | Хранит фиксированные планы: `pre_competition_21`, `speed_first_action_14`, `legs_lme_21`, `taper_10`, `recovery_7` и похожие пресеты. |
| Выбор старых карточек | `packages/shared/src/constructor-core.ts`, `selectTemplateCards` | Выбирает карточки по фазе, длительности, целям и рискам. Для `start_window` или близкого старта выбирает `taper_10`. |
| Сбор недель | `packages/shared/src/constructor-core.ts`, `mergeWeeks` | Создаёт нужное число недель и для каждой берёт `sourceWeek` из выбранных карточек. |
| Привязка недели к старой карточке | `packages/shared/src/constructor-core.ts`, `pickSourceWeekForPhase` | Для фазы выбирает неделю из `cards.flatMap(card => card.weeks)`. Это главный старый template-driven участок. |
| Частный Europe-case генератор | `packages/shared/src/constructor-core.ts`, `normalizeWeekDensity`, `europeCompetitionDaysForWeek`, `europeCompetitionDayForStage` | Для главного старта `<=30` частично заменяет дни на специальную структуру Европы. Это полезный слой, но он пока не оформлен как универсальная матрица. |
| Утро/вечер | `packages/shared/src/constructor-core.ts`, `dayWithExplicitSessions`, `dayWithSingleSession` | Формирует сессии `УТРО` и `ВЕЧЕР`. Сейчас это связано с конкретными helper-функциями, а не с общей матрицей типов дней. |
| Блоки/упражнения/объём | `packages/shared/src/constructor-core.ts`, `concreteVolumeForBlock`, `concreteExercisesForBlock`, block helper-функции | Превращает блоки в упражнения и объёмы. Часть объёмов уже конкретная, но источник выбора блока смешан: старые карточки + Europe-case. |
| Проверки рисков | `packages/shared/src/constructor-core.ts`, `collectRiskFlags` | Проверяет вес, близкий старт, сон, готовность, пульс покоя, боль, нехватку данных, дорогу. |
| Объяснение | `packages/shared/src/constructor-core.ts`, `buildCompetitionFocusPlan`, `buildUnderstoodMainTask`, `buildUnderstoodInterpretation`, `buildMainDecisionText`, `buildWhyNowText` | Формирует объяснение "что система поняла" и "почему сейчас". Оно уже хорошее по голове, но не всегда связано с телом плана. |
| API генерации | `apps/api/src/api/planning/planning.routes.ts`, `POST /api/v1/plans/constructor/draft` | Вызывает `buildPerformConstructorDraft(body)` и возвращает `draft + templatePayload`. |
| Парсинг API body | `apps/api/src/api/planning/planning.schemas.ts`, `parseConstructorDraftBody` | Пропускает `seasonStrategy` и не требует новых полей. Это удобно для миграции без изменения API-контракта. |
| UI конструктора | `apps/web/app/page-client.tsx`, вкладка Planning Studio Constructor | Показывает календарь старта, стратегию сезона, фокус, "что система поняла", draft-план и кнопку сохранения шаблона. |
| Тесты | `scripts/check-perform-constructor-core.mjs` | Проверяет 30/28/23/21/10/4-дневные сценарии, но сейчас ещё ожидает `selectedCards`, то есть тесты частично закрепляют старую логику. |

Вывод: "тело" уже частично улучшено через Europe-case, но старые карточки всё ещё управляют планом через `selectTemplateCards -> mergeWeeks -> pickSourceWeekForPhase`.

## 2. Разделение "головы" и "тела"

### 2.1 Голова конструктора

Голова должна отвечать только на вопросы:

```text
кто спортсмен
какой календарь стартов
какой старт выбран
какая роль старта
сколько дней осталось
какой год олимпийского цикла
какая стратегия сезона
какая фаза подготовки
какие режимы разрешены
какие режимы запрещены
какие фокусы обязательны
какие фокусы заблокированы
```

Текущий код для этого уже в основном есть:

- `buildSeasonStrategySnapshot`;
- `phaseForTarget`;
- `cycleLengthForTarget`;
- `rulesForSnapshot`;
- `applySeasonStrategyToConstructorInput`;
- frontend-функции выбора старта и расчёта дней.

### 2.2 Тело конструктора

Тело должно отвечать на вопросы:

```text
какой тип недели нужен
какой тип дня нужен
есть ли утром тренировка
есть ли вечером тренировка
какой блок разрешён
какой блок запрещён
какой объём допустим
какие упражнения подходят
что заменить при риске
какое объяснение дать тренеру
```

Именно тело сейчас надо перевести на матрицу. Старые карточки могут остаться только как библиотека блоков и примеров наполнения.

### 2.3 Где старая логика управляет телом

Критичные места:

1. `CONSTRUCTOR_TEMPLATE_CARDS` - старые карточки содержат не только блоки, но и недели/дни.
2. `selectTemplateCards` - выбирает карточки как план.
3. `mergeWeeks` - строит недели через выбранные карточки.
4. `pickSourceWeekForPhase` - берёт неделю из старой карточки под фазу.
5. `draft.selectedCards` - UI и тесты показывают выбранные карточки, из-за чего карточки выглядят как источник решения.
6. `scripts/check-perform-constructor-core.mjs` - тесты требуют `draft.selectedCards.length > 0`, то есть старые карточки пока являются частью ожидаемого результата.

Безопасный вывод: нельзя просто удалить карточки. Нужно сначала перевести их в `block library`, а `selectedCards` временно оставить как trace/evidence, чтобы не ломать UI и API.

## 3. Целевая фазовая матрица

### 3.1 Сопоставление фаз

| Тренерская фаза | Существующая фаза в коде | Смысл | Важное ограничение |
| --- | --- | --- | --- |
| Общеподготовительная | `base` | База, ОФП, аэробная база, общая сила, общая выносливость | Можно развивать качества, если старт далеко. |
| Специально-подготовительная | `development` или `special_preparation` | Развитие с переносом в борьбу, СФП, техника, ковёр | Развитие допустимо только если старт достаточно далеко. |
| Специальная предсоревновательная | `special_preparation` | Перед главным стартом `15-30` дней: поддержание, перенос в борьбу, контроль качества | Развитие запрещено для главного старта. |
| Непосредственная предсоревновательная | `taper` | `5-14` дней: снижение объёма, качество, вес, восстановление | Развивающие блоки запрещены. |
| Подводка / taper | `taper` | Суперкомпенсация, свежесть, короткая активация | Нельзя смешивать с тяжёлыми СФП/ЛМВ/силой. |
| Соревновательная | `start_window` | `0-4` дня: дорога, взвешивание, старт, восстановление | Только короткая активация, вес, сон, техническая уверенность. |
| Восстановительная / переходная | `recovery` | После старта или перегруза | Без развивающей нагрузки. |

Новые публичные значения фаз добавлять не обязательно. На первом этапе можно сохранить `ConstructorPhase`, а внутри ввести матричные `WeekType` и `DayType`.

### 3.2 Типы недель

| WeekType | Когда используется | Нагрузка | Ковёр | СФП | ОФП | Развитие | Восстановление | Ограничения |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `development_week` | Старт далеко, база/спецподготовка | средняя-высокая | средний-высокий | можно | можно | можно | плановое | Нельзя ставить конфликт ног + скорость без разгрузки. |
| `maintenance_week` | После развития или перед переходом к старту | средняя | средний | поддержание | можно лёгко | нет или ограничено | обязательное | Блоки должны сохранять качество, а не добирать объём. |
| `special_week` | Специальная работа в борьбе | средняя-высокая | высокий, но контролируемый | поддержание/перенос | ограничено | только если старт далеко | обязательное | Контакт и техника должны иметь recovery windows. |
| `pre_competition_week` | `D-30...D-17` главного старта | средняя | средний | поддержание/перенос | лёгкое | запрещено | обязательное | ЛМВ только коротко, без отказа, не как развитие. |
| `integration_week` | `D-16...D-10` | средняя-низкая | средний-низкий | только перенос | почти нет | запрещено | усиленное | Схватки ограничены, качество выше объёма. |
| `unload_week` | После двух полных дней или при усталости | низкая-средняя | низкий | нет/лёгко | можно как смена | запрещено | главное | Смена обстановки: кросс, прогулка, вода, восстановление. |
| `taper_week` | `D-9...D-5` | низкая | низкий | нет | нет | запрещено | главное | Только активация и техническая уверенность. |
| `competition_week` | `D-4...старт` | очень низкая | минимальный | нет | нет | запрещено | главное | Дорога, взвешивание, старт, сон, вес. |
| `logistics_week` | Неделя с дорогой/лагерем/сменой часового пояса | низкая-средняя | по месту | нет/лёгко | лёгко | запрещено | главное | Нагрузка зависит от дороги и сна. |
| `post_start_week` | После старта | низкая | анализ/лёгко | нет | лёгко | запрещено | главное | Восстановление, разбор, возврат к режиму. |

### 3.3 Типы дней

| DayType | Утро | Вечер | Ковёр | Силовая | ЛМВ ног | Скорость | Соревновательная модель | Сауна/восстановление | Близость к старту |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `heavy_training_day` | да | да | да | можно | можно | ограничено | можно | после нагрузки | Не ближе `D-17` к главному старту. |
| `medium_training_day` | да | да/нет | да | лёгко | коротко | коротко | можно ограниченно | да | До `D-10`, если нет рисков. |
| `light_day` | да | нет/лёгко | лёгко | нет | нет | коротко | нет | да | Можно в taper, но без добора. |
| `technical_day` | да | да/нет | техника | нет | нет | короткая активация | нет/лёгко | да | Можно до `D-4`, если объём малый. |
| `competition_model_day` | да | да/нет | модель раундов | нет | нет | только в рамках борьбы | да | обязательно | Не ближе `D-10`; в `D-9...D-5` только облегчённый вариант. |
| `mat_day` | да | да/нет | ковёр | нет/лёгко | нет | нет/коротко | по фазе | да | В стартовом окне минимально. |
| `spp_day` | да | да/нет | по переносу | можно поддержание | можно коротко | можно коротко | нет/лёгко | да | Не как развитие в последние 30 дней главного старта. |
| `gpp_day` | да | нет/лёгко | нет/лёгко | можно | можно | можно | нет | да | Далеко от старта или как смена обстановки. |
| `half_day` | да | нет | лёгко/средне | нет/лёгко | нет | нет/коротко | нет | обязательно | Среда/суббота для накопившейся недели. |
| `environment_shift_day` | да/нет | нет | нет | нет | нет | нет | нет | прогулка/кросс/поход/вода | Нужен для психологии и снятия коврового напряжения. |
| `recovery_day` | нет/лёгко | нет | нет | нет | нет | нет | нет | да | В любой фазе по риску. |
| `sauna_recovery_day` | нет/лёгко | нет | нет | нет | нет | нет | нет | сауна по весу и состоянию | Нельзя при обезвоживании или активной сгонке без контроля. |
| `travel_day` | нет/лёгко | нет | нет | нет | нет | нет | нет | мобилити/сон | Тяжёлая нагрузка запрещена. |
| `weigh_in_day` | коротко | нет | нет/короткая уверенность | нет | нет | нет/2-3 включения | нет | вес/сон/вода | Тяжёлая нагрузка запрещена. |
| `start_day` | старт | нет | старт | нет | нет | стартовая активация | старт | восстановление после | Только соревновательная логика. |
| `post_start_day` | нет/лёгко | нет | анализ/мобилити | нет | нет | нет | нет | восстановление | Без развивающей нагрузки. |

### 3.4 Правила утро / вечер

1. Две сессии допустимы, если день не является `half_day`, `travel_day`, `weigh_in_day`, `start_day`, `recovery_day` или `post_start_day`.
2. После двух полных дней подряд обязательно вставляется `half_day` или `environment_shift_day`.
3. В последние `0-4` дня до главного старта максимум одна короткая сессия в день.
4. В `D-9...D-5` вечерняя сессия разрешена только как восстановление, вес, сон, видео/тактика, мобилити.
5. Ковёр + тяжёлая СФП в один день допустимы только далеко от главного старта и при хорошей готовности.
6. ЛМВ ног + скорость первого действия в один день запрещены без явной разгрузки и без высокой готовности.
7. Если есть дорога, вечер нельзя использовать для добора нагрузки.
8. Если есть взвешивание, нагрузка подчиняется весу, воде, сну и свежести.
9. Утро обычно несёт основную работу, вечер - восстановление, техника качества, видео/тактика или лёгкая СФП.

### 3.5 Библиотека блоков

| Блок | Фазы | WeekType | DayType | Утро | Вечер | Максимальная близость к старту | Риски | Нельзя сочетать | Объяснение |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `mat_technique` - ковёр: техника | `base`, `development`, `special_preparation`, `taper`, `start_window` | почти все, кроме чистого recovery | `technical_day`, `mat_day`, `light_day` | да | да/лёгко | до `D-1`, если объём малый | усталость, качество техники | с тяжёлой СФП в taper | "Сохраняем качество технических действий без добора объёма." |
| `mat_tactics` - ковёр: тактика | `special_preparation`, `taper` | special, integration, taper | `technical_day`, `mat_day` | да | да/видео | до `D-1` | когнитивная усталость | с плотной борьбой в taper | "Уточняем решения и сценарии, не перегружая тело." |
| `competition_model` - соревновательная модель | `special_preparation`, ранний `taper` | special, pre_competition, integration | `competition_model_day` | да | нет/лёгко | не ближе `D-10` как полный блок | гликолитика, контакт, усталость | ЛМВ ног, тяжёлая сила | "Проверяем перенос качеств в борьбу, но ограничиваем близко к старту." |
| `control_bouts` - контрольные схватки | `development`, `special_preparation` | special, development | `competition_model_day` | да | нет | не ближе `D-14` к главному старту | контакт, травмы, ЦНС | тяжёлая СФП, недосып | "Контроль нужен далеко от старта; близко к старту риск выше пользы." |
| `light_mat_confidence` - лёгкая техническая уверенность | `taper`, `start_window` | taper, competition | `light_day`, `technical_day`, `weigh_in_day` | да | нет | можно до старта | минимальный | любые тяжёлые блоки | "Оставляем уверенность и ритм без накопления усталости." |
| `spp_transfer` - СФП перенос | `development`, `special_preparation` | development, special, pre_competition | `spp_day`, `medium_training_day` | да | да/лёгко | до `D-17` как средний блок, позже только коротко | локальная усталость | контрольные схватки, тяжёлая скорость | "СФП поддерживает борьбу, но не становится самостоятельным развитием перед стартом." |
| `gpp` - ОФП | `base`, `development`, `recovery` | base, development, unload, post_start | `gpp_day`, `environment_shift_day` | да | нет/лёгко | в последние 14 дней только лёгко | лишний объём | тяжёлый ковёр в taper | "ОФП используется как база или смена обстановки." |
| `legs_lme` - ЛМВ ног | `base`, `development`, ранняя `special_preparation` | development, special, pre_competition | `spp_day`, `medium_training_day` | да | нет/лёгко | не ближе `D-17` как полноценный блок; `D-30...D-17` только поддержание | ноги, таз, спина, восстановление | спринты, плотная борьба, дорога | "Локальная работа допустима только без отказа и с контролем восстановления." |
| `first_action_activation` - резкость первого действия | `special_preparation`, `taper`, `start_window` | pre_competition, integration, taper, competition | `technical_day`, `light_day` | да | нет | можно до `D-1`, если коротко | ЦНС, техника | ЛМВ ног, тяжёлая силовая | "Не развиваем скорость, а поддерживаем резкость первого действия." |
| `aerobic_unload` - аэробная разгрузка | все кроме стартового дня | unload, recovery, post_start | `environment_shift_day`, `recovery_day`, `half_day` | да | нет | можно до `D-1`, если лёгко | вес/усталость при избытке | тяжёлый ковёр в тот же день | "Смена обстановки и восстановление без коврового напряжения." |
| `mobility` - мобилити | все | все | light/recovery/travel/weigh_in | да | да | можно всегда | минимальный | нет | "Снимаем напряжение и сохраняем движение." |
| `recovery` - восстановление | все | все | recovery/half/post_start | да/нет | да/нет | обязательно ближе к старту | риск недовосстановления при пропуске | с тяжёлым добором | "Восстановление является частью плана, а не пустым днём." |
| `sauna` - сауна/процедуры | special, taper, recovery | unload, taper, competition | `sauna_recovery_day`, `half_day` | нет/лёгко | да/нет | по весу и состоянию | обезвоживание, весогонка | тяжёлый день после сауны | "Процедуры ставятся как инструмент восстановления и контроля веса." |
| `travel` - дорога | taper, start_window | logistics, competition | `travel_day` | нет/лёгко | нет | по календарю | сон, усталость, часовой пояс | тяжёлые блоки | "Дорога снижает тренировочный потолок дня." |
| `weigh_in` - взвешивание | start_window | competition | `weigh_in_day` | коротко | нет | день взвешивания | вода, питание, стресс | тяжёлые блоки | "Вес и свежесть важнее нагрузки." |
| `start` - старт | start_window | competition | `start_day` | старт | нет | день старта | соревновательный стресс | тренировки сверх старта | "День подчинён соревнованию." |
| `post_start_recovery` - после старта | recovery | post_start | `post_start_day` | нет/лёгко | нет | 1-3 дня после старта | скрытая усталость | развивающие блоки | "Сначала восстановление и разбор, потом новый цикл." |

### 3.6 Явные запреты близко к старту

1. Перед главным стартом `<=30` дней запрещён режим `development`.
2. `D-30...D-17`: ЛМВ ног допустима только как поддержание СФП, без отказа и без тяжёлого объёма.
3. `D-16...D-10`: контрольные схватки и плотная борьба ограничены; качество выше объёма.
4. `D-9...D-5`: нельзя ставить развивающие блоки, тяжёлую силу, тяжёлую ЛМВ, гликолитический добор.
5. `D-4...старт`: только вес, сон, дорога, короткая активация, техническая уверенность.
6. День дороги: тяжёлая нагрузка запрещена.
7. День взвешивания: тяжёлая нагрузка запрещена, возможна только короткая активация.
8. День после старта: восстановление, анализ, без развития.
9. Нельзя случайно смешивать `taper` с развивающими блоками.
10. Нельзя использовать старые fixed template cards как план.

## 4. Целевой алгоритм генерации

```mermaid
flowchart TD
  A["Календарь стартов"] --> B["Выбрать релевантный старт"]
  B --> C["Определить роль старта"]
  C --> D["Посчитать дни до старта"]
  D --> E["Определить фазу подготовки"]
  E --> F["Определить тип недели"]
  F --> G["Определить тип каждого дня"]
  G --> H["Решить УТРО / ВЕЧЕР"]
  H --> I["Подобрать блоки из библиотеки"]
  I --> J["Подобрать упражнения и объём"]
  J --> K["Проверить риски"]
  K --> L["Удалить или заменить запрещённые блоки"]
  L --> M["Сформировать объяснение тренерской логики"]
  M --> N["Вернуть draft-план"]
```

Пошагово:

1. Получить календарь стартов выбранного спортсмена.
2. Найти выбранный или ближайший релевантный старт.
3. Определить роль старта: главный пик, второй пик, квалификация, контрольный.
4. Посчитать точные дни до старта.
5. Определить фазу подготовки через сезон, олимпийский цикл и роль старта.
6. Построить фазовую карту на оставшееся число дней, без округления к 7/14/21/30.
7. Для каждой календарной недели определить `WeekType`.
8. Для каждого календарного дня определить `DayType`.
9. Для каждого дня определить допустимость `УТРО` и `ВЕЧЕР`.
10. Подобрать блоки из `TrainingBlockDefinition[]`.
11. Подобрать упражнения и объём по фазе, типу дня, готовности и рискам.
12. Выполнить risk checks: вес, сон, готовность, боль, пульс покоя, дорога, близость старта, контакт, локальная нагрузка.
13. Удалить или заменить запрещённые блоки.
14. Сформировать объяснение: почему такая фаза, почему такой день, почему блок разрешён или заменён.
15. Вернуть draft-план и `templatePayload`.

Старые карточки могут использоваться только на шагах 10-11 как источник блоков/упражнений/примеров объёма. Они не должны определять фазу, тип недели, тип дня или структуру календаря.

## 5. Предлагаемые структуры данных

На первом этапе API менять не нужно. Лучше расширить shared-слой внутри `packages/shared/src/constructor-core.ts` или вынести матрицу в новый файл `packages/shared/src/constructor-matrix.ts`.

### 5.1 Использовать существующие типы

Сохраняем:

- `ConstructorPhase`;
- `ConstructorGoalType`;
- `ConstructorGoalMode`;
- `ConstructorBlockType`;
- `ConstructorLoadLevel`;
- `ConstructorRiskCode`;
- `ConstructorPlanWeek`;
- `ConstructorPlanDay`;
- `ConstructorPlanSession`;
- `ConstructorPlanBlock`;
- `SeasonStrategySnapshot`;
- `SeasonStrategyCompetitionRole`;

### 5.2 Минимально добавить новые типы

```ts
export type ConstructorWeekType =
  | "development_week"
  | "maintenance_week"
  | "special_week"
  | "pre_competition_week"
  | "integration_week"
  | "unload_week"
  | "taper_week"
  | "competition_week"
  | "logistics_week"
  | "post_start_week";

export type ConstructorDayType =
  | "heavy_training_day"
  | "medium_training_day"
  | "light_day"
  | "technical_day"
  | "competition_model_day"
  | "mat_day"
  | "spp_day"
  | "gpp_day"
  | "half_day"
  | "environment_shift_day"
  | "recovery_day"
  | "sauna_recovery_day"
  | "travel_day"
  | "weigh_in_day"
  | "start_day"
  | "post_start_day";

export type ConstructorSessionSlot = "morning" | "evening";

export type ConstructorTrainingBlockKind =
  | "mat_technique"
  | "mat_tactics"
  | "competition_model"
  | "control_bouts"
  | "light_mat_confidence"
  | "spp_transfer"
  | "gpp"
  | "legs_lme"
  | "first_action_activation"
  | "aerobic_unload"
  | "mobility"
  | "recovery"
  | "sauna"
  | "environment_shift"
  | "travel"
  | "weigh_in"
  | "start"
  | "post_start_recovery";
```

### 5.3 Правила матрицы

```ts
export interface ConstructorPhaseWindowRule {
  phase: ConstructorPhase;
  minDaysToStart: number | null;
  maxDaysToStart: number | null;
  competitionRoles: SeasonStrategyCompetitionRole[];
  weekTypes: ConstructorWeekType[];
  allowedModes: ConstructorGoalMode[];
  forbiddenModes: ConstructorGoalMode[];
  explanation: string;
}

export interface ConstructorWeekMatrixRule {
  weekType: ConstructorWeekType;
  phases: ConstructorPhase[];
  minDaysToStart: number | null;
  maxDaysToStart: number | null;
  allowedDayTypes: ConstructorDayType[];
  maxMatVolume: "none" | "low" | "medium" | "high";
  sppAllowed: boolean;
  gppAllowed: boolean;
  developmentAllowed: boolean;
  recoveryRole: "support" | "mandatory" | "primary";
  explanation: string;
}

export interface ConstructorDayMatrixRule {
  dayType: ConstructorDayType;
  allowedWeekTypes: ConstructorWeekType[];
  allowedSlots: ConstructorSessionSlot[];
  maxSessions: 0 | 1 | 2;
  maxMatVolume: "none" | "low" | "medium" | "high";
  strengthAllowed: boolean;
  legsLmeAllowed: boolean;
  speedAllowed: boolean;
  competitionModelAllowed: boolean;
  recoveryRequired: boolean;
  maxDaysBeforeMainStart: number | null;
  explanation: string;
}

export interface ConstructorTrainingBlockDefinition {
  kind: ConstructorTrainingBlockKind;
  title: string;
  blockType: ConstructorBlockType;
  targetQuality: ConstructorGoalType;
  allowedPhases: ConstructorPhase[];
  allowedWeekTypes: ConstructorWeekType[];
  allowedDayTypes: ConstructorDayType[];
  allowedSlots: ConstructorSessionSlot[];
  maxDaysBeforeMainStart: number | null;
  contraindicatedWith: ConstructorTrainingBlockKind[];
  riskCodes: ConstructorRiskCode[];
  evidenceRefs: string[];
  defaultVolume: string;
  explanation: string;
}

export interface ConstructorBlockEligibilityResult {
  allowed: boolean;
  reason: string;
  replacementKind?: ConstructorTrainingBlockKind;
}

export interface ConstructorMatrixDecisionReason {
  code:
    | "calendar_start"
    | "season_strategy"
    | "phase_window"
    | "week_type"
    | "day_type"
    | "block_allowed"
    | "block_blocked"
    | "risk_replacement"
    | "missing_data";
  message: string;
}
```

### 5.4 Совместимость с текущим draft

Текущий `ConstructorDraft` можно не ломать. Внутри можно добавить необязательные поля:

```ts
matrixTrace?: {
  weekType: ConstructorWeekType;
  dayTypes: Array<{
    dayLabel: string;
    dayType: ConstructorDayType;
    reasons: ConstructorMatrixDecisionReason[];
  }>;
};

selectedCards?: ...
```

Но лучше на первом этапе не менять внешний API. `matrixTrace` можно добавить после подтверждения UI.

## 6. Поэтапный план внедрения

### Этап 1. Инвентаризация старых карточек

Цель: не удалять старые карточки, а классифицировать их содержимое.

Что сделать:

- пройти `CONSTRUCTOR_TEMPLATE_CARDS`;
- разбить их на отдельные блоки;
- каждому блоку назначить `ConstructorTrainingBlockKind`;
- сохранить evidence/rationale;
- создать compatibility layer: старая карточка -> список блоков;
- оставить `selectedCards` только как trace/evidence.

Файлы:

- `packages/shared/src/constructor-core.ts`;
- возможно новый `packages/shared/src/constructor-block-library.ts`;
- `scripts/check-perform-constructor-core.mjs`.

### Этап 2. Создать phase/week/day matrix

Цель: появится тело конструктора, которое решает не по карточкам, а по фазе, неделе и дню.

Что сделать:

- добавить `ConstructorWeekType`;
- добавить `ConstructorDayType`;
- добавить `ConstructorSessionSlot`;
- добавить `ConstructorTrainingBlockDefinition`;
- описать матрицу правил;
- добавить eligibility checks для блоков;
- добавить запреты близко к старту.

Файлы:

- новый `packages/shared/src/constructor-matrix.ts`;
- `packages/shared/src/constructor-core.ts`;
- `docs/perform-constructor-core-stack.md`;

### Этап 3. Переключить генератор

Цель: `mergeWeeks` больше не берёт тело из fixed templates.

Что сделать:

- добавить функцию `buildMatrixDrivenWeeks(input, focusPlan, riskFlags)`;
- заменить основной путь `selectTemplateCards -> mergeWeeks` на `buildMatrixDrivenWeeks`;
- старые карточки использовать только для выбора блоков и объёмов;
- `pickSourceWeekForPhase` оставить временно как fallback;
- в объяснении показывать week/day/block reasons.

Файлы:

- `packages/shared/src/constructor-core.ts`;
- `apps/web/app/page-client.tsx`;
- `scripts/check-perform-constructor-core.mjs`.

### Этап 4. Усилить проверки и объяснение

Цель: система должна не просто строить план, а объяснять, почему запрещает или заменяет блок.

Что сделать:

- добавить тесты на день дороги, взвешивание, стартовое окно;
- объяснение "почему сейчас" связать с `matrixTrace`;
- показывать, почему ЛМВ/скорость/плотность борьбы не являются развитием в последние 30 дней;
- убрать старые формулировки типа "не хватает данных для развивающего плана" в start/taper windows.

Файлы:

- `packages/shared/src/constructor-core.ts`;
- `apps/web/app/page-client.tsx`;
- `scripts/check-perform-constructor-core.mjs`.

### Этап 5. Депрекация управляющих карточек

Цель: fixed templates больше не управляют планом.

Что сделать:

- переименовать `selectedCards` в UI в "использованные блоки / источники";
- удалить требование `draft.selectedCards.length > 0` из тестов;
- оставить старые карточки как архивные источники блоков;
- при необходимости вынести карточки в отдельный каталог block-library.

Файлы:

- `packages/shared/src/constructor-core.ts`;
- `apps/web/app/page-client.tsx`;
- `scripts/check-perform-constructor-core.mjs`;
- документация.

## 7. Тестовые сценарии

### 7.1 Главный старт, 28 дней

Ожидается:

- фаза: `special_preparation`;
- длина плана: ровно 28 дней;
- развитие запрещено;
- фокус: специальная борьба, соревновательная модель, поддержание СФП, вес, восстановление, подводка;
- ЛМВ ног не как развитие, а только как поддержание/перенос;
- план не должен напрямую брать `pre_competition_21` как структуру.

### 7.2 Главный старт, 21 день

Ожидается:

- специальная предсоревновательная работа;
- объём снижается относительно полного специального блока;
- ковёр есть, но с recovery windows;
- контрольные схватки ограничены;
- ЛМВ ног не тяжёлый, без отказа;
- среда/суббота или аналогичные дни должны быть разгрузочными, если неделя плотная.

### 7.3 Главный старт, 10 дней

Ожидается:

- `taper`;
- развитие запрещено;
- ковёр снижен;
- восстановление и сон важнее добора объёма;
- СФП только коротко/поддерживающе или запрещена по риску.

### 7.4 Главный старт, 3 дня

Ожидается:

- `start_window`;
- максимум одна короткая сессия в день;
- разрешены лёгкая техника, вес, сон, восстановление, короткая активация;
- запрещены тяжёлая ЛМВ, силовая, плотная борьба, контрольные схватки;
- объяснение явно говорит: развитие запрещено из-за близости старта.

### 7.5 День дороги

Ожидается:

- `travel_day`;
- тяжёлая нагрузка запрещена;
- возможна мобилити, лёгкая активизация, сон, восстановление;
- объяснение учитывает логистику.

### 7.6 День взвешивания

Ожидается:

- `weigh_in_day`;
- тяжёлая нагрузка запрещена;
- возможна короткая активация;
- вес, вода, питание и восстановление важнее нагрузки.

### 7.7 День после старта

Ожидается:

- `post_start_day` или `recovery_day`;
- восстановление;
- анализ;
- без развивающей нагрузки.

### 7.8 Второстепенный старт

Ожидается:

- роль старта влияет на жёсткость запретов;
- контрольный старт не обязан запрещать развитие так же строго, как главный старт;
- taper может быть короче;
- объяснение указывает, что старт не является главным пиком.

### 7.9 Обычная развивающая неделя далеко от старта

Ожидается:

- `base` или `development`;
- развивающие блоки разрешены;
- СФП/ОФП допустимы;
- ковёр может быть больше;
- восстановление всё равно планируется, но не блокирует развитие.

### 7.10 Регрессия на старые ошибки

Ожидается:

- 4 дня до старта не строят 7-дневный шаблон;
- 4 дня до старта не строят 8 ковровых тренировок;
- 28 дней до старта не показывают "развитие ЛМВ" как главную цель;
- `taper_10` не управляет структурой плана;
- старые карточки не определяют тип недели и тип дня.

## 8. Риски миграции

| Риск | Что может сломаться | Как снижать риск |
| --- | --- | --- |
| Удалить старые карточки слишком рано | UI, тесты, templatePayload, сохранение шаблона | Не удалять. Сначала перевести в block library и оставить trace. |
| Сломать API | Мобильные приложения и сайт ждут старую форму draft | Не менять API-контракт на первом этапе. |
| Сделать слишком общий генератор | План снова станет общими фразами | Матрица должна выбирать конкретные блоки, упражнения и объём. |
| Слишком жёсткие запреты | Тренер не сможет вручную адаптировать план | Автоматически блокировать только критичные нарушения, остальное помечать риском и разрешать ручное подтверждение. |
| Потерять эталон Европы | План уйдёт от проверенной подготовки | Использовать `docs/europe-2026-plan-analysis.md` как validation benchmark. |
| Смешать фазы и цели | "ЛМВ" опять станет развитием перед стартом | Ввести `mode`: development/maintenance/transfer/activation/recovery и показывать в UI. |
| Увеличить сложность тестов | Тесты станут трудно поддерживать | Разделить тесты: фаза, неделя, день, блок, risk, explanation. |
| Неполные данные спортсмена | Конструктор будет строить опасно уверенный план | Сохранять confidence и missingData; рискованные блоки заменять безопасными. |
| Не учесть логистику | В день дороги появится тяжёлая тренировка | `travel_day` должен быть отдельным DayType с жёсткими запретами. |
| Не учесть психологическую разгрузку | Слишком много ковра подряд | `environment_shift_day` и `half_day` должны быть частью матрицы, а не случайным добавлением. |

## 9. Файлы, которые потребуется менять на следующем этапе

Минимальный набор:

1. `packages/shared/src/constructor-core.ts`
   - убрать управление телом через `selectTemplateCards -> mergeWeeks -> pickSourceWeekForPhase`;
   - добавить matrix-driven week/day generation;
   - сохранить старые карточки как библиотеку блоков.

2. Новый файл `packages/shared/src/constructor-matrix.ts`
   - типы недели;
   - типы дня;
   - правила фаз;
   - eligibility rules;
   - block library definitions.

3. Возможный новый файл `packages/shared/src/constructor-block-library.ts`
   - старые карточки как источники блоков и объёмов.

4. `scripts/check-perform-constructor-core.mjs`
   - заменить ожидание `selectedCards` как управляющего механизма на проверки matrix behavior;
   - добавить сценарии 28/21/10/3 дня, дорога, взвешивание, после старта, второстепенный старт, далеко от старта.

5. `apps/web/app/page-client.tsx`
   - изменить подписи в UI: `selectedCards` -> "источники блоков / методические источники";
   - показать phase/week/day explanation, если после утверждения добавим `matrixTrace`.

6. `apps/api/src/api/planning/planning.routes.ts`
   - вероятно не менять на первом этапе;
   - оставить `POST /api/v1/plans/constructor/draft` как есть.

7. `apps/api/src/api/planning/planning.schemas.ts`
   - вероятно не менять на первом этапе;
   - новые поля добавлять только после подтверждения.

8. `docs/perform-constructor-core-stack.md`
   - добавить ссылку на этот transition plan и зафиксировать новую матрицу после утверждения.

9. `docs/europe-2026-plan-analysis.md`
   - использовать как benchmark, не обязательно менять.

Database schema менять не нужно на первом этапе.

## 10. Что менять первым после утверждения

Самый безопасный первый кодовый шаг:

1. Добавить `constructor-matrix.ts` с типами и правилами.
2. Добавить функцию `deriveConstructorMatrixCalendar(input)`:
   - возвращает week/day/session skeleton без упражнений.
3. Покрыть её тестами:
   - 28 дней;
   - 4 дня;
   - дорога;
   - взвешивание;
   - после старта.
4. Пока не подключать её к реальному `buildPerformConstructorDraft`.

Почему так:

- мы проверим тело конструктора отдельно;
- не сломаем текущий сайт;
- тренерская логика станет видимой;
- после подтверждения подключим skeleton к генератору блоков.

## 11. Команды проверки

Запущены во время анализа:

```bash
rg -n "function mergeWeeks|function normalizeWeekDensity|function buildFallbackWeek|function dayWithExplicitSessions|function dayWithSingleSession|function concreteVolumeForBlock|function concreteExercisesForBlock|function pickSourceWeekForPhase|function buildCompetitionFocusPlan|function buildConstructorTemplatePayload|function buildPerformConstructorDraft" packages/shared/src/constructor-core.ts
rg -n "CONSTRUCTOR_TEMPLATE_CARDS|selectTemplateCards|mergeWeeks\\(|selectedCards|templatePayload|constructorSeasonStrategySnapshot|buildConstructorInputFromForm|handleBuildConstructorDraft" packages/shared/src/constructor-core.ts apps/web/app/page-client.tsx apps/api/src/api/planning/planning.routes.ts scripts/check-perform-constructor-core.mjs
nl -ba packages/shared/src/constructor-core.ts | sed -n '360,520p'
nl -ba packages/shared/src/constructor-core.ts | sed -n '1000,1075p'
nl -ba packages/shared/src/constructor-core.ts | sed -n '1160,1315p'
nl -ba packages/shared/src/constructor-core.ts | sed -n '2700,2915p'
nl -ba packages/shared/src/constructor-core.ts | sed -n '3090,3165p'
nl -ba packages/shared/src/constructor-core.ts | sed -n '3660,3745p'
nl -ba packages/shared/src/constructor-core.ts | sed -n '3820,4025p'
nl -ba packages/shared/src/season-strategy.ts | sed -n '300,430p'
nl -ba apps/web/app/page-client.tsx | sed -n '320,545p'
nl -ba apps/web/app/page-client.tsx | sed -n '13900,14195p'
nl -ba apps/api/src/api/planning/planning.routes.ts | sed -n '100,160p'
nl -ba apps/api/src/api/planning/planning.schemas.ts | sed -n '221,250p'
nl -ba scripts/check-perform-constructor-core.mjs | sed -n '560,650p'
nl -ba scripts/check-perform-constructor-core.mjs | sed -n '900,965p'
npm run check:constructor-core
git status --short
```

`npm run check:constructor-core` проходил до создания этого документа и показал, что текущие тесты зелёные, но всё ещё закрепляют наличие `selectedCards`.

## 12. Статус первого безопасного внедрения

Дата: 2026-06-09.

Подготовительный matrix-driven слой добавлен без переключения текущего генератора.

Что реализовано:

- новый shared-модуль `packages/shared/src/constructor-matrix.ts`;
- типы `ConstructorPreparationPhase`, `ConstructorWeekType`, `ConstructorDayType`, `ConstructorSessionSlot`, `ConstructorTrainingBlockType`;
- декларативные правила фаз, недель и дней;
- библиотека стартовых тренировочных блоков;
- eligibility-функции:
  - `getWeekTypeForContext`;
  - `getDayTypeForContext`;
  - `getAllowedSessionSlots`;
  - `isTrainingBlockAllowed`;
  - `getForbiddenBlockReasons`;
  - `filterAllowedTrainingBlocks`;
  - `explainBlockEligibility`;
- compatibility layer для старых карточек:
  - `pre_competition_21`;
  - `speed_first_action_14`;
  - `legs_lme_21`;
  - `arms_grip_21`;
  - `taper_10`;
  - `recovery_7`;
- focused-проверки в `scripts/check-perform-constructor-core.mjs` по сценариям 28/21/10/3 дня, дорога, взвешивание, день после старта, второстепенный старт, далёкая развивающая неделя.

Что намеренно не изменено:

- `selectTemplateCards`;
- `mergeWeeks`;
- `pickSourceWeekForPhase`;
- текущий `buildPerformConstructorDraft`;
- API-контракт `POST /api/v1/plans/constructor/draft`;
- database schema;
- production-facing UI.

Статус: выполнено как подготовительный matrix rules layer. Текущий production-facing генератор не переключён.

Следующий безопасный PR после rules layer:

1. Сделать adapter `buildMatrixDrivenWeekSkeleton(input)`.
2. Проверить skeleton отдельно от текущего draft.
3. После утверждения заменить тело `mergeWeeks` на matrix-driven skeleton + block selection.
4. Оставить старые карточки только как block inventory/evidence.

Этот PR закрыт в этапе 2 ниже.

## 13. Этап 2: Matrix-driven week skeleton

Дата: 2026-06-09.

Этап 2 закрывает первый безопасный adapter-шаг без переключения старого генератора.

### 13.1 Что реализовано

Добавлен shared-модуль `packages/shared/src/constructor-matrix-skeleton.ts`.

Основная функция:

```ts
buildMatrixDrivenWeekSkeleton(input)
```

Функция принимает текущий `ConstructorInput` или отдельный `MatrixDrivenSkeletonContext` и строит только матричный skeleton:

```text
days_to_start
→ preparation_phase
→ week_type
→ day_type
→ morning/evening
→ allowed / forbidden training blocks
→ explanations
```

Новые типы:

- `MatrixDrivenSkeletonContext`;
- `MatrixDrivenPlanSkeleton`;
- `MatrixDrivenWeekSkeleton`;
- `MatrixDrivenDaySkeleton`;
- `MatrixDrivenSessionSkeleton`;
- `MatrixDrivenBlockCandidate`;
- `MatrixDrivenSkeletonWarning`;
- `MatrixDrivenSkeletonExplanation`.

Новые helper-функции:

- `getDaysUntilStartForSkeletonDay`;
- `getWeekDayRange`;
- `buildSkeletonContextForDay`;
- `buildSkeletonContextForSession`;
- `getPreferredBlockTypesForDayType`;
- `getForbiddenBlockTypesForDayType`.

Модуль экспортирован через `packages/shared/src/index.ts`.

### 13.2 Какие правила использует skeleton

Skeleton не выбирает готовую старую неделю. Он использует:

- `getWeekTypeForContext`;
- `getDayTypeForContext`;
- `getAllowedSessionSlots`;
- `getForbiddenBlockReasons`;
- `isTrainingBlockAllowed`;
- `CONSTRUCTOR_TRAINING_BLOCK_LIBRARY`;
- `CONSTRUCTOR_TEMPLATE_CARD_COMPATIBILITY`.

Старые карточки участвуют только как compatibility metadata:

```text
sourceCompatibilityCards
```

Это нужно, чтобы видеть, из какого legacy-источника может прийти блок. Но карточка не управляет:

- типом недели;
- типом дня;
- количеством дней;
- структурой утро/вечер;
- разрешением или запретом блока.

### 13.3 Что намеренно не изменено

На этом этапе не менялись:

- `selectTemplateCards`;
- `mergeWeeks`;
- `pickSourceWeekForPhase`;
- `buildPerformConstructorDraft`;
- API-контракт;
- DB schema;
- UI;
- production-facing поведение конструктора.

Этап 2 только добавляет проверяемый matrix-driven skeleton рядом со старым генератором.

### 13.4 Покрытые сценарии

Проверки добавлены в `scripts/check-perform-constructor-core.mjs`.

Покрыто:

- 28 дней до главного старта: skeleton строится матрицей, старые карточки не управляют структурой, развитие запрещено, специальная работа допустима;
- 21 день до главного старта: восстановление становится обязательным, тяжёлая ЛМВ ног остаётся запрещённой;
- 10 дней до главного старта: taper/competition структура, нет развития и тяжёлой СФП, есть лёгкая техника, восстановление и мобилити;
- 3 дня до главного старта: короткое стартовое окно, одна сессия, нет тяжёлого ковра и контрольных схваток;
- день дороги: `travel`, допускаются mobility/recovery, запрещается соревновательная модель;
- день взвешивания: `weigh_in`, допускается контроль веса, запрещается тяжёлая нагрузка;
- день соревнований: `competition`, допускается `competition_start`, день не выглядит как обычная тренировка;
- день после соревнований: `post_competition`, допускается восстановление, запрещается развивающая ОФП;
- второстепенный старт: не получает жёсткое предупреждение главного старта;
- далёкая развивающая неделя: допускает development blocks, СФП/ОФП и двухсессионные дни;
- текущий `ConstructorInput` с `SeasonStrategySnapshot`: skeleton корректно принимает существующую голову конструктора.

### 13.5 Команды проверки этапа 2

Запущены:

```bash
npm run build --workspace @training-platform/shared
npm run check:constructor-core
```

Результат: обе команды прошли успешно.

### 13.6 Следующий PR после этапа 2

Следующий шаг уже является отдельным большим этапом:

1. Сделать `matrixDrivenPlanBuilder` на базе skeleton.
2. Добавить `volumeAllocator`, `riskCheckEngine`, `explanationBuilder`.
3. Подключить новый путь за безопасным переключателем или явным internal-path.
4. Доказать тестом, что matrix-driven путь не вызывает `selectTemplateCards -> mergeWeeks -> pickSourceWeekForPhase`.
5. Только после этого заменять старое тело `buildPerformConstructorDraft`.

Этот PR закрыт в этапе 3 ниже как отдельный builder без переключения production-facing генератора.

## 14. Этап 3: Matrix-driven plan builder

Дата: 2026-06-09.

Этап 3 добавляет отдельный `matrix-driven` builder, который превращает skeleton в черновик плана с выбранными блоками, начальными объёмами, risk checks и explanations. Старый `buildPerformConstructorDraft` по умолчанию не переключён.

### 14.1 Что реализовано

Добавлен shared-модуль `packages/shared/src/constructor-matrix-plan-builder.ts`.

Основная функция:

```ts
buildMatrixDrivenPlanDraft(input, options?)
```

Цепочка нового пути:

```text
ConstructorInput
→ buildMatrixDrivenWeekSkeleton(input)
→ buildMatrixDrivenWeeksFromSkeleton(input, skeleton)
→ buildMatrixDrivenDayFromSkeleton(...)
→ buildMatrixDrivenSessionFromSkeleton(...)
→ selectMatrixDrivenBlocksForSession(...)
→ applyMatrixDrivenVolumeRules(...)
→ applyMatrixDrivenRiskChecks(...)
→ buildMatrixDrivenPlanExplanations(...)
```

Модуль экспортирован через `packages/shared/src/index.ts`.

### 14.2 Новые типы

Добавлены отдельные matrix draft-типы:

- `MatrixDrivenPlanDraft`;
- `MatrixDrivenPlanWeek`;
- `MatrixDrivenPlanDay`;
- `MatrixDrivenPlanSession`;
- `MatrixDrivenSelectedBlock`;
- `MatrixDrivenVolumePrescription`;
- `MatrixDrivenRiskCheckResult`;
- `MatrixDrivenExplanation`;
- `MatrixDrivenBuilderOptions`.

`MatrixDrivenBuilderOptions` поддерживает:

- `mode: "skeleton_only" | "draft"`;
- `useLegacyCardsAsContentLibrary`;
- `includeForbiddenCandidates`;
- `explanationDepth: "short" | "normal" | "detailed"`.

По умолчанию:

- `mode = "draft"`;
- `useLegacyCardsAsContentLibrary = true`;
- `includeForbiddenCandidates = false`;
- `explanationDepth = "normal"`.

### 14.3 Volume rules

Добавлен начальный `applyMatrixDrivenVolumeRules`.

Он задаёт:

- `loadLevel`: `very_low`, `low`, `medium`, `high`;
- `intensityLevel`: `recovery`, `light`, `moderate`, `high`;
- `durationMinutes`: `min`, `max`, `target`;
- `matVolume`: `none`, `low`, `medium`, `high`;
- `density`: `single_session`, `split_day`, `half_day`, `recovery_only`;
- `recoveryPriority`.

Начальные правила консервативные:

- далеко от старта development может давать `medium/high`;
- `D-28` главный старт держит controlled special work без heavy development;
- `D-10` и `D-3` переводятся в low/very-low taper/start-window logic;
- travel/weigh-in дают very-low short sessions;
- competition day не получает тренировочный объём;
- post-competition уходит в recovery-only.

Точные упражнения и финальные числовые объёмы пока не подбираются: это следующий слой после безопасного builder-а.

### 14.4 Risk checks

Добавлен отдельный `applyMatrixDrivenRiskChecks`.

Покрытые matrix risk codes:

- `main_start_development_forbidden`;
- `heavy_lmv_too_close_to_start`;
- `heavy_strength_too_close_to_start`;
- `excessive_mat_volume_near_start`;
- `control_bouts_too_close_to_start`;
- `heavy_load_on_travel_day`;
- `heavy_load_on_weigh_in_day`;
- `taper_mixed_with_development`;
- `competition_day_training_load`;
- `post_competition_development_load`;
- `legacy_template_used_as_structure`.

Risk checks не молчат о запрещённых блоках: rejected candidates остаются в отчёте с причиной, replacement hint и affected week/day/session/block.

### 14.5 Explanation levels

Добавлены explanation уровни:

- plan-level: роль старта, D-day, фаза, запрет развития, legacy-card policy;
- week-level: week type, load, mat volume, recovery priority;
- day-level: day type и допустимые слоты;
- session-level: выбранный slot и block mix;
- block-level: почему блок выбран, какая volume prescription и какие source metadata.

Особенно фиксируется:

- `D-28`: специальная предсоревновательная логика, не старая карточка;
- `D-10`: taper/direct pre-comp;
- `D-3`: развитие запрещено из-за близости главного старта;
- travel/weigh-in: логистика и вес ограничивают нагрузку;
- post-competition: восстановление и анализ.

### 14.6 Legacy cards

Старые карточки по-прежнему не управляют matrix path.

Разрешено:

- `sourceCompatibilityCards`;
- metadata/content hints;
- labels/methodology notes.

Запрещено:

- брать `card.weeks` как структуру;
- брать старые дни как управляющую структуру;
- вызывать `selectTemplateCards` как управляющий выбор нового builder-а;
- использовать `pre_competition_21`, `speed_first_action_14`, `taper_10` как готовый план.

Matrix draft возвращает:

```ts
generatedFrom: "matrix"
legacyCards.usedAsStructure: false
```

### 14.7 Что намеренно не изменено

Не изменены:

- `selectTemplateCards`;
- `mergeWeeks`;
- `pickSourceWeekForPhase`;
- default-path `buildPerformConstructorDraft`;
- API-контракты;
- database schema;
- UI;
- production-facing поведение конструктора.

### 14.8 Проверки этапа 3

Проверки добавлены в `scripts/check-perform-constructor-core.mjs`.

Покрыто:

- `buildMatrixDrivenPlanDraft` возвращает matrix draft с weeks/days/sessions, explanations и risk checks;
- 28 дней до главного старта: special work выбран, heavy development/LMV не выбран;
- 21 день: heavy leg LMV и control bouts не выбраны, volume controlled;
- 10 дней: taper/direct pre-comp, light technical/recovery/mobility, без heavy SPP;
- 3 дня: только light activation/recovery/weight control, без heavy/control blocks;
- travel day: mobility/recovery, heavy load rejected;
- weigh-in day: short activation/recovery, без mat/control/SFP;
- competition day: `competition_start`, без ordinary training load;
- post-competition: recovery, без development/contact stress;
- secondary start: ограничения мягче, но obvious risky blocks режутся;
- far development week: development blocks, SPP/GPP, larger workload, two sessions;
- skeleton-only option: skeleton есть, plan weeks не строятся;
- default legacy generator behavior остаётся рабочим через старые проверки `buildPerformConstructorDraft`.

### 14.9 Команды проверки этапа 3

Запущены:

```bash
npm run build --workspace @training-platform/shared
npm run check:constructor-core
```

Результат: обе команды прошли успешно.

### 14.10 Следующий PR после этапа 3

Следующий шаг:

1. Сделать controlled adapter / feature flag для `buildPerformConstructorDraft`.
2. Начать частичную замену тела `mergeWeeks` на matrix draft.
3. Старые карточки оставить только как block content library.
4. Добавить regression tests уже на итоговый `ConstructorDraft`, а не только на отдельный matrix draft.

Пункт 1 закрыт этапом 4 ниже через отдельную experimental-функцию без изменения default `buildPerformConstructorDraft`.

## 15. Этап 4: Controlled matrix-driven constructor adapter

Дата: 2026-06-09.

Этап 4 добавляет controlled adapter, который переводит `MatrixDrivenPlanDraft` в существующий constructor-compatible output. Default legacy path не изменён.

### 15.1 Что реализовано

Добавлен shared-модуль `packages/shared/src/constructor-matrix-adapter.ts`.

Основная experimental-функция:

```ts
buildMatrixDrivenConstructorDraft(input, options?)
```

Выбран безопасный вариант A:

- `buildPerformConstructorDraft(input)` не меняет сигнатуру;
- default behavior остаётся legacy/template-driven;
- matrix path вызывается только явно через `buildMatrixDrivenConstructorDraft`.

### 15.2 Adapter-функции

Добавлены:

- `adaptMatrixDrivenDraftToConstructorWeeks(matrixDraft, input)`;
- `adaptMatrixDrivenWeekToConstructorWeek(matrixWeek, input)`;
- `adaptMatrixDrivenDayToConstructorDay(matrixDay, input)`;
- `adaptMatrixDrivenSessionToConstructorSession(matrixSession, input)`;
- `buildMatrixDrivenConstructorDraft(input, options?)`.

### 15.3 Что переносится в ConstructorDraft-compatible shape

Adapter переносит:

- weeks -> `ConstructorPlanWeek[]`;
- days -> `ConstructorPlanDay[]`;
- morning/evening sessions -> `ConstructorPlanSession[]`;
- selected matrix blocks -> `ConstructorPlanBlock[]`;
- volume prescription -> `volume`, `localLoadZones`, `energySystem`, `readinessGate`;
- risk tags -> block `riskFlags`;
- matrix risk checks -> constructor `riskFlags` и `explanation.riskImpact`;
- matrix explanations -> `understood`, week/day/session notes, `explanation`;
- sourceCompatibilityCards -> `selectedCards` и `evidenceRefs` как metadata/content hints.

Дополнительно experimental output расширен безопасным metadata-блоком:

```ts
generatedFrom: "matrix"
matrix: {
  draft,
  riskChecks,
  explanationCount,
  legacyCards
}
```

Это отдельная функция, поэтому production API и старый output не меняются.

### 15.4 Legacy cards policy

Legacy cards в matrix adapter используются только как:

- content metadata;
- `legacy-content:*` evidence refs;
- selectedCards-описание источников контента.

Они не используются как:

- week source;
- day source;
- готовая структура;
- управляющая логика.

Normal matrix path фиксирует:

```ts
generatedFrom: "matrix"
matrix.legacyCards.usedAsStructure === false
```

### 15.5 Regression guards

В `scripts/check-perform-constructor-core.mjs` добавлены проверки:

- `buildMatrixDrivenConstructorDraft` возвращает constructor-compatible weeks/days/sessions/blocks;
- matrix metadata и risk checks сохраняются;
- 28 дней: special work есть, heavy LMV нет;
- 21 день: heavy LMV/control bouts не попадают в adapted output;
- 10 дней: taper без heavy development/SPP/control bouts;
- 3 дня: no heavy/control/development, explanation про запрет развития;
- travel: light logistics blocks и explanation про дорогу;
- weigh-in: no mat/control/SFP и explanation про вес;
- competition day: только `competition_start`;
- post-competition: recovery, no development;
- secondary start: мягче main start, но close-start LMV режется;
- far development: development/SPP/GPP и two-session days доступны;
- default `buildPerformConstructorDraft(input)` остаётся legacy-compatible и не получает `generatedFrom=matrix`.

### 15.6 Что намеренно не изменено

Не изменены:

- `selectTemplateCards`;
- `mergeWeeks`;
- `pickSourceWeekForPhase`;
- default `buildPerformConstructorDraft`;
- API contracts;
- database schema;
- UI;
- production-facing constructor behavior.

### 15.7 Команды проверки этапа 4

Запущены:

```bash
npm run build --workspace @training-platform/shared
npm run check:constructor-core
```

Результат: обе команды прошли успешно.

### 15.8 Следующий PR после этапа 4

Следующий шаг:

1. Controlled rollout в UI/API или internal flag.
2. Сравнение legacy vs matrix draft на одинаковых inputs.
3. Постепенная замена `mergeWeeks` internals.
4. Regression tests на реальных сценариях тренера.
5. Debug/telemetry output для сравнения двух путей.

Пункт 2 закрыт этапом 5 ниже как отдельный comparison/dual-run слой без переключения production path.

## 16. Этап 5: Legacy vs matrix comparison layer

Дата: 2026-06-09.

Этап 5 добавляет отдельный dual-run слой для сравнения legacy и matrix-driven draft на одинаковых входных данных.

### 16.1 Что реализовано

Добавлен shared-модуль `packages/shared/src/constructor-matrix-comparison.ts`.

Основные функции:

- `compareLegacyAndMatrixConstructorDrafts(input, options?)`;
- `buildConstructorDraftComparisonReport(legacyDraft, matrixDraft, input, options?)`;
- `summarizeConstructorDraftDifferences(report)`;
- `assertMatrixDraftSafetyInvariants(matrixDraft, input)`;
- `assertLegacyDefaultUnchanged(input)`.

Dual-run цепочка:

```text
legacy: buildPerformConstructorDraft(input)
matrix: buildMatrixDrivenConstructorDraft(input)
→ ConstructorDraftComparisonReport
→ ConstructorDraftComparisonSummary
```

Production path не переключается.

### 16.2 Что сравнивается

Comparison layer не делает full snapshot. Он сравнивает устойчивые инварианты:

- наличие weeks/days/sessions;
- week count;
- day coverage;
- session density;
- block count;
- наличие risk output;
- наличие explanation output;
- legacy template dependency;
- matrix generated marker;
- matrix legacy-card policy;
- close-start safety;
- travel/weigh-in/competition/post-competition handling.

### 16.3 Safety invariants matrix path

`assertMatrixDraftSafetyInvariants` проверяет:

- `generatedFrom === "matrix"`;
- есть weeks/days/sessions;
- нет `legacy_template_used_as_structure`;
- fixed template cards не являются structural source;
- нет development/heavy LMV near main start;
- нет heavy strength close to start;
- нет control bouts close to start;
- нет heavy travel load;
- нет heavy weigh-in load;
- competition day содержит `competition_start`;
- post-competition содержит recovery/post-competition recovery;
- explanations присутствуют.

Если invariant нарушен, возвращается structured result с severity, affected и explanation.

### 16.4 Legacy default guard

`assertLegacyDefaultUnchanged(input)` проверяет:

- `buildPerformConstructorDraft(input)` вызывается без options;
- legacy output сохраняет weeks/days/explanation;
- default output не получает `generatedFrom=matrix`;
- selectedCards остаются частью текущего legacy behavior.

### 16.5 Human-readable summary

`summarizeConstructorDraftDifferences(report)` возвращает:

- `safeToPreview`;
- `legacyDefaultUnchanged`;
- `totalDifferences`;
- `errorCount`;
- `warningCount`;
- `expectedDifferenceCount`;
- `headline`;
- top differences.

Пример успешного смысла:

```text
Matrix draft is safe for internal preview; differences are expected due to matrix-driven block selection.
```

### 16.6 Проверки этапа 5

В `scripts/check-perform-constructor-core.mjs` добавлены dual-run сценарии:

- 28 дней до главного старта;
- 21 день;
- 10 дней;
- 3 дня;
- travel day;
- weigh-in day;
- competition day;
- post-competition;
- secondary/control start;
- far development week;
- legacy default guard.

Проверяется, что matrix path safe для internal preview, а legacy default path не подменён.

### 16.7 Что намеренно не изменено

Не изменены:

- `selectTemplateCards`;
- `mergeWeeks`;
- `pickSourceWeekForPhase`;
- default `buildPerformConstructorDraft`;
- API route contracts;
- DB schema;
- UI;
- storage/telemetry.

### 16.8 Команды проверки этапа 5

Запущены:

```bash
npm run build --workspace @training-platform/shared
npm run check:constructor-core
```

Результат: обе команды прошли успешно.

### 16.9 Следующий PR после этапа 5

Следующий шаг закрыт этапом 6 ниже:

1. Internal preview flag для API/UI или debug endpoint.
2. Side-by-side preview для тренера.
3. Controlled rollout matrix path для выбранных сценариев.
4. Сбор feedback/regression cases.
5. Только после этого — постепенная замена `mergeWeeks` internals.

## 17. Этап 6: Internal matrix comparison preview

Дата: 2026-06-09.

Этап 6 добавляет внутренний preview/debug path для matrix-driven конструктора. Это не rollout и не переключение production generator.

### 17.1 Что реализовано

Добавлен shared-модуль `packages/shared/src/constructor-matrix-preview.ts`.

Основная функция:

- `buildConstructorComparisonPreview(input, options?)`.

Preview собирает side-by-side объект:

```text
legacy: buildPerformConstructorDraft(input)
matrix: buildMatrixDrivenConstructorDraft(input)
comparison: compareLegacyAndMatrixConstructorDrafts(input)
summary: summarizeConstructorDraftDifferences(report)
safety: matrix invariants + legacy default guard
```

Возвращаемый объект помечен:

```text
generatedFrom: "legacy_matrix_comparison_preview"
mode: "comparison_preview"
```

### 17.2 Output preview

`ConstructorComparisonPreview` содержит:

- `legacyDraft`;
- `matrixDraft`;
- `comparisonReport`;
- `summary`;
- `safety`;
- `safetyInvariants`;
- `legacyDefaultGuard`;
- `safeToPreview`;
- `defaultPathUnchanged`;
- `warnings`;
- `notes`;
- `generatedAt`.

Для уменьшения размера output доступны опции:

- `includeDrafts`;
- `includeComparisonReport`;
- `includeSafetyDetails`;
- `explanationDepth`;
- `failOnMatrixSafetyError`;
- `matrixOptions`;
- `includeInfoDifferences`.

По умолчанию shared-функция возвращает drafts, report и safety details, потому что она предназначена для internal checks.

### 17.3 Как читать preview

Ключевые поля:

- `safeToPreview` — можно показывать matrix рядом с legacy во внутреннем QA;
- `summary.expectedDifferenceCount` — ожидаемые отличия legacy/matrix, это не ошибка;
- `warnings` — structured warning/error/info список;
- `safety.matrixSafetyPassed` — matrix не нарушила критичные правила;
- `safety.defaultPathUnchanged` — legacy default guard зелёный;
- `legacyDefaultGuard` — подтверждает, что обычный `buildPerformConstructorDraft(input)` не стал matrix path.

Если `includeDrafts: false`, top-level `legacyDraft` и `matrixDraft` не возвращаются. Если `includeSafetyDetails: false`, подробные invariants не возвращаются, но summary/safety остаются.

### 17.4 API/debug endpoint

На этапе 6 API не изменён.

Причина: текущий production route `POST /api/v1/plans/constructor/draft` имеет стабильный контракт и сразу возвращает `draft + templatePayload`. Чтобы не менять mobile/web/API behavior, preview пока доступен только через shared-функцию и check-script.

Отдельный endpoint или controlled flag можно добавлять следующим PR после утверждения политики auth/output:

```text
POST /api/v1/internal/plans/constructor/preview-comparison
```

или explicit debug flag без изменения default response.

### 17.5 Что preview не делает

Preview:

- не пишет в DB;
- не создаёт шаблон;
- не назначает план спортсмену;
- не меняет UI;
- не меняет API response;
- не переключает default generator;
- не логирует персональные данные;
- не добавляет telemetry/storage.

### 17.6 Проверки этапа 6

В `scripts/check-perform-constructor-core.mjs` добавлены сценарии:

- preview smoke;
- default legacy guard до/после preview;
- input immutability;
- `28`, `10`, `3` дня до главного старта;
- travel day;
- weigh-in day;
- competition day;
- post-competition;
- far development week;
- output options `includeDrafts: false`;
- output options `includeComparisonReport: false`;
- output options `includeSafetyDetails: false`.

Проверяется, что expected differences не считаются error, matrix safety invariants зелёные, а default `buildPerformConstructorDraft` остаётся legacy.

### 17.7 Что намеренно не изменено

Не изменены:

- `selectTemplateCards`;
- `mergeWeeks`;
- `pickSourceWeekForPhase`;
- default `buildPerformConstructorDraft`;
- production API contracts;
- DB schema;
- UI;
- storage/telemetry;
- fixed template cards.

Legacy cards остаются metadata/content hints для matrix path, но не становятся structural source.

### 17.8 Команды проверки этапа 6

Запускать перед сдачей:

```bash
npm run build --workspace @training-platform/shared
npm run check:constructor-core
npm run check
```

Если в будущем будет добавлен API/debug endpoint, дополнительно запускать релевантную API/web сборку.

### 17.9 Следующий PR после этапа 6

Следующий шаг закрыт этапом 7 ниже:

1. Internal UI side-by-side panel для тренера/QA.
2. Controlled API/debug endpoint или explicit preview flag для выбранных пользователей.
3. Real-world regression fixtures по календарю стартов, 4/10/28 дней, travel/weigh-in/start/post-start.
4. После накопления fixtures — controlled rollout отдельных сценариев на matrix path.
5. Только после подтверждения — постепенная замена internals `mergeWeeks`, без удаления legacy cards раньше времени.

## 18. Этап 7: Constructor matrix preview regression fixtures

Дата: 2026-06-09.

Этап 7 добавляет regression fixture pack для internal matrix comparison preview. Это не production rollout и не переключение default generator.

### 18.1 Где лежат fixtures

Fixture pack:

```text
scripts/fixtures/constructor/preview-regression-fixtures.mjs
```

Runner:

```text
scripts/constructor-preview-fixture-runner.mjs
```

Документация:

```text
docs/constructor-matrix-preview-fixtures.md
```

Runner подключён в `scripts/check-perform-constructor-core.mjs`, поэтому fixtures запускаются через:

```bash
npm run check:constructor-core
```

### 18.2 Формат fixture

Каждый fixture содержит:

- `id`;
- `title`;
- `description`;
- `input`;
- `expectations.legacy`;
- `expectations.matrix`;
- `expectations.comparison`.

Минимальные exported-типы добавлены в `packages/shared/src/constructor-matrix-preview.ts`:

- `ConstructorPreviewFixture`;
- `ConstructorPreviewFixtureLegacyExpectations`;
- `ConstructorPreviewFixtureMatrixExpectations`;
- `ConstructorPreviewFixtureComparisonExpectations`.

Fixture проверяет инварианты, а не full snapshot всего draft.

### 18.3 Покрытые сценарии

Добавлено 11 synthetic scenarios:

1. `main_start_d28_special_pre_competition`;
2. `main_start_d21_controlled_volume`;
3. `main_start_d10_taper`;
4. `main_start_d3_final_activation`;
5. `travel_day`;
6. `weigh_in_day`;
7. `competition_day`;
8. `post_competition_day`;
9. `secondary_start_d10`;
10. `far_development_week_d90`;
11. `missing_readiness_data`.

### 18.4 Что проверяет runner

Runner проверяет:

- preview строится и имеет marker `legacy_matrix_comparison_preview`;
- legacy draft и matrix draft строятся;
- comparison report строится;
- `defaultPathUnchanged === true`;
- legacy default guard зелёный;
- preview не мутирует fixture input;
- `safeToPreview` совпадает с expectation;
- forbidden/required matrix block types;
- required-any matrix block groups;
- forbidden/required risk codes;
- required explanation keywords;
- matrix safety errors и comparison errors;
- forbidden difference severities;
- allowed difference categories, если заданы;
- evening session, если fixture этого требует.

### 18.5 Safe-data rules

Fixtures synthetic-only. Запрещено добавлять:

- реальные имена;
- даты рождения;
- контакты;
- production IDs;
- медицинские записи;
- данные часов;
- `.env`;
- cookies;
- browser profiles;
- dumps/logs с боевого сайта.

### 18.6 Что намеренно не изменено

Не изменены:

- `buildPerformConstructorDraft`;
- `selectTemplateCards`;
- `mergeWeeks`;
- `pickSourceWeekForPhase`;
- production API contracts;
- DB schema;
- UI;
- storage/telemetry.

### 18.7 Следующий PR после этапа 7

Следующий шаг закрыт этапом 8 ниже:

1. Internal side-by-side UI panel для QA/тренера.
2. Controlled debug endpoint или explicit preview flag после утверждения auth/output.
3. Добавление новых real-world synthetic regression cases на основе обнаруженных ошибок конструктора.
4. Только после стабильного fixture pack — controlled rollout отдельных сценариев на matrix path.

## 19. Этап 8: Internal API/debug matrix preview

Дата: 2026-06-09.

Этап 8 добавляет internal/debug API endpoint для matrix-vs-legacy constructor preview. Это не production rollout и не изменение обычного constructor draft route.

### 19.1 Endpoint

Добавлен endpoint:

```text
POST /api/v1/plans/constructor/internal/matrix-preview
```

Назначение: внутренний QA/dev preview, который явно вызывает:

```text
buildConstructorMatrixPreviewResponse(input, options?)
```

и возвращает `ConstructorMatrixPreviewResponse`.

### 19.2 Request

Формат body:

```json
{
  "input": {
    "competition": {},
    "athlete": {},
    "context": {},
    "goals": [],
    "tests": {},
    "state": {},
    "constraints": {},
    "seasonStrategy": null
  },
  "options": {
    "includeDrafts": false,
    "includeComparisonReport": true,
    "includeSafetyDetails": false,
    "explanationDepth": "normal",
    "failOnMatrixSafetyError": false,
    "includeInfoDifferences": false,
    "matrixOptions": {
      "mode": "draft",
      "useLegacyCardsAsContentLibrary": true,
      "includeForbiddenCandidates": false,
      "explanationDepth": "normal"
    }
  }
}
```

Parser whitelist-ит только поддержанные preview options. Обычный `POST /api/v1/plans/constructor/draft` не меняется.

### 19.3 Response

Response — это preview object:

- `generatedFrom: "legacy_matrix_comparison_preview"`;
- `mode: "comparison_preview"`;
- `safeToPreview`;
- `defaultPathUnchanged`;
- `summary`;
- `safety`;
- `warnings`;
- `notes`;
- optional `legacyDraft`;
- optional `matrixDraft`;
- optional `comparisonReport`;
- optional `safetyInvariants`;
- optional `legacyDefaultGuard`.

Если `includeDrafts=false`, full `legacyDraft/matrixDraft` не возвращаются. Summary и safety остаются доступными.

### 19.4 Auth и безопасность

Endpoint использует тот же security pattern, что production constructor draft route:

- `dependencies.guards.requireUser(request)`;
- разрешены только `coach` и `admin`;
- `dependencies.guards.assertAthleteAccess(user, input.athlete.athleteId)`;
- без auth endpoint недоступен;
- без доступа к athlete endpoint недоступен.

Endpoint:

- не пишет в DB;
- не создаёт шаблон;
- не назначает план;
- не сохраняет preview;
- не логирует input/body;
- не меняет cookies/session/CORS;
- не меняет mobile contracts;
- не меняет production constructor route response.

### 19.5 API helper

В shared добавлены:

- `ConstructorMatrixPreviewApiOptions`;
- `ConstructorMatrixPreviewRequest`;
- `ConstructorMatrixPreviewResponse`;
- `buildConstructorMatrixPreviewResponse(input, options?)`.

API route использует helper и не содержит бизнес-логики конструктора.

### 19.6 Проверки этапа 8

В `scripts/check-perform-constructor-core.mjs` добавлены focused checks для API response helper:

- `includeDrafts=false`;
- `includeComparisonReport=false`;
- `includeSafetyDetails=false`;
- no input mutation;
- D-3 main start;
- travel day;
- weigh-in day;
- `defaultPathUnchanged`.

Полноценный route-level smoke test не добавлен, потому что в проекте нет лёгкого route-test harness без запуска auth/session окружения. Основная защита endpoint покрыта тем, что route повторяет существующий guard pattern, а response helper проверяется отдельно.

### 19.7 Что намеренно не изменено

Не изменены:

- `buildPerformConstructorDraft`;
- `selectTemplateCards`;
- `mergeWeeks`;
- `pickSourceWeekForPhase`;
- production `POST /api/v1/plans/constructor/draft`;
- DB schema;
- UI;
- mobile API contracts;
- storage/telemetry.

### 19.8 Следующий PR после этапа 8

Этап 9 закрыл первый internal UI слой:

1. В web Planning Studio Constructor добавлена collapsed-панель `Matrix preview / internal`.
2. Панель доступна внутри уже существующего coach/admin конструктора и вызывает только:
   `POST /api/v1/plans/constructor/internal/matrix-preview`.
3. Preview имеет отдельную кнопку, отдельные loading/error/success/retry состояния и не меняет основной `constructorDraft`.
4. Preview не пишет в DB, не создаёт шаблон, не назначает план спортсмену, не сохраняет результат в localStorage/sessionStorage.
5. Production `POST /api/v1/plans/constructor/draft` не изменён.

Следующие шаги после этапа 9:

1. Ручная QA на реальных сценариях конструктора.
2. Дополнительные synthetic regression fixtures после ручной QA.
3. Controlled rollout matrix path для отдельных сценариев только после подтверждения.

## 20. Этап 9: Internal UI side-by-side preview

### 20.1 Где находится UI

UI добавлен в:

```text
apps/web/app/page-client.tsx
```

Место:

- `activeWorkspace === "planning-studio"`;
- `planningView === "constructor"`;
- внутри существующего coach/admin-gated Planning Studio.

Панель:

```text
Matrix preview / internal
Сравнение legacy vs matrix - internal
```

Она collapsed по умолчанию и расположена после обычного `Draft plan`.

### 20.2 Что вызывает UI

Панель вызывает:

```http
POST /api/v1/plans/constructor/internal/matrix-preview
```

Request:

```json
{
  "input": "...ConstructorInput from current constructor form...",
  "options": {
    "includeDrafts": true,
    "includeComparisonReport": true,
    "includeSafetyDetails": true,
    "explanationDepth": "normal",
    "includeInfoDifferences": false
  }
}
```

Есть отдельный checkbox `includeInfoDifferences`. Это влияет только на internal comparison output.

### 20.3 Что показывает UI

Панель показывает:

- summary: `safeToPreview`, `defaultPathUnchanged`, error/warning/expected/total counts, headline;
- safety: matrix safety status, legacy default guard status, failed invariants, warnings;
- side-by-side overview: legacy/matrix weeks, days, sessions, blocks, close-start days;
- matrix decision explanation: phase, competition role, D-day proximity, development rule, logistics flags, explanations;
- differences list: category, severity, message, affected week/day/session/block;
- optional collapsed raw JSON.

### 20.4 Что намеренно не изменено

Не изменены:

- `buildPerformConstructorDraft(input)`;
- `POST /api/v1/plans/constructor/draft`;
- `constructorDraft` state основного UI;
- сохранение шаблона;
- назначение плана спортсмену;
- DB schema;
- mobile contracts;
- `selectTemplateCards`;
- `mergeWeeks`;
- `pickSourceWeekForPhase`.

### 20.5 Safety-интерпретация

Панель не означает rollout matrix path.

Правильное чтение:

- `safeToPreview=true` — можно смотреть matrix draft внутренне рядом с legacy;
- `defaultPathUnchanged=true` — обычный legacy default path не изменился;
- `expectedDifferenceCount>0` — ожидаемые отличия, не обязательно ошибка;
- `matrix safety failed` — matrix output нельзя использовать даже внутренне без разбора;
- `legacy guard failed` — надо остановиться, потому что default-path invariant нарушен.

## 21. Этап 10: Controlled matrix rollout gate

### 21.1 Зачем нужен gate

Internal preview показывает, что matrix draft можно безопасно смотреть рядом с legacy, но это ещё не
означает, что matrix можно отдавать как основной результат.

Controlled rollout gate добавлен как отдельный слой:

```text
ConstructorInput + comparison preview + safety invariants -> rollout decision
```

Он отвечает на вопрос:

```text
legacy default / preview only / internal matrix / primary matrix / blocked
```

Default generator не изменён:

```text
buildPerformConstructorDraft(input)
```

по-прежнему остаётся legacy path.

### 21.2 Где реализовано

Shared module:

```text
packages/shared/src/constructor-matrix-rollout.ts
```

Экспортируется через:

```text
packages/shared/src/index.ts
```

Основные функции:

- `decideMatrixConstructorRollout(input, options?)`;
- `classifyConstructorRolloutScenario(input, preview?)`;
- `isMatrixScenarioAllowlisted(scenario, input, preview?, options?)`;
- `getMatrixRolloutBlockers(input, preview?, options?)`;
- `buildMatrixRolloutDecisionExplanation(decision)`;
- `buildMatrixConstructorDraftIfAllowed(input, options?)`.

### 21.3 Modes

Rollout decision может вернуть:

- `legacy_only` — использовать только legacy default;
- `preview_only` — matrix можно показывать только в side-by-side preview;
- `matrix_allowed_for_internal` — matrix можно использовать только во внутреннем/QA сценарии;
- `matrix_allowed_for_primary` — matrix разрешён как primary только через explicit helper;
- `blocked` — matrix заблокирован safety/contract/rollout blockers.

### 21.4 Scenarios

Начальная классификация:

- `far_development_week`;
- `post_competition_recovery`;
- `travel_day`;
- `weigh_in_day`;
- `secondary_start_preview`;
- `main_start_d28_preview`;
- `main_start_d21_preview`;
- `main_start_d10_preview`;
- `main_start_d3_preview`;
- `competition_day_preview`;
- `unknown`;
- `unsafe`.

Важно: scenario классифицирует текущий фокус окна, а не любой день внутри длинного draft.
Например, 28-дневный draft может содержать будущий weigh-in day, но scenario остаётся
`main_start_d28_preview`, а не `weigh_in_day`.

### 21.5 Initial allowlist

`matrix_allowed_for_primary`:

- `far_development_week`;
- `post_competition_recovery`.

`matrix_allowed_for_internal`:

- `travel_day`;
- `weigh_in_day`.

`preview_only`:

- `secondary_start_preview`;
- `main_start_d28_preview`;
- `main_start_d21_preview`;
- `main_start_d10_preview`;
- `main_start_d3_preview`;
- `competition_day_preview`.

Почему D-28/D-21/D-10/D-3 главного старта не primary:

- это критическое окно подготовки;
- ошибки в объёме/ковре/подводке могут стоить старта;
- matrix должен сначала пройти side-by-side feedback на реальных тренерских кейсах;
- legacy остаётся основным источником production draft.

### 21.6 Blockers

Rollout gate возвращает structured blockers:

- `matrix_safety_error`;
- `legacy_default_changed`;
- `comparison_error`;
- `forbidden_risk_code`;
- `legacy_template_used_as_structure`;
- `main_start_too_close_for_primary`;
- `competition_day_primary_not_enabled`;
- `missing_required_explanation`;
- `unknown_scenario`;
- `not_allowlisted`;
- `explicitly_disabled`;
- `input_mutation_detected`.

Hard blockers (`severity: "error"`) переводят decision в `blocked`.
Warning blockers могут оставлять сценарий в `preview_only` или `legacy_only`, но запрещают тихий rollout.

### 21.7 Internal API

Добавлен отдельный internal endpoint:

```http
POST /api/v1/plans/constructor/internal/matrix-rollout-decision
```

Request:

```json
{
  "input": "...ConstructorInput...",
  "options": {
    "previewOptions": {
      "includeDrafts": true,
      "includeComparisonReport": true,
      "includeSafetyDetails": true
    }
  }
}
```

Response:

```json
{
  "generatedFrom": "matrix_constructor_rollout_decision",
  "mode": "preview_only",
  "scenario": "main_start_d28_preview",
  "allowlisted": true,
  "safeToPreview": true,
  "defaultPathUnchanged": true,
  "matrixPrimaryAllowed": false,
  "blockers": [],
  "previewSummary": {},
  "explanation": {},
  "recommendedAction": "show_preview_only"
}
```

Endpoint внутренний:

- использует те же auth/athlete-access guard'ы;
- не пишет в DB;
- не создаёт шаблон;
- не меняет production route.

Старый endpoint `POST /api/v1/plans/constructor/internal/matrix-preview` не изменён.

### 21.8 Helper для explicit matrix primary

Добавлен helper:

```text
buildMatrixConstructorDraftIfAllowed(input, options?)
```

Default:

- `fallbackToLegacy: true`;
- `requirePrimaryAllowed: false`;
- `allowedModes: ["matrix_allowed_for_primary"]`.

То есть:

- для `far_development_week` helper может вернуть matrix draft;
- для `main_start_d3_preview` helper по умолчанию вернёт legacy fallback;
- если `fallbackToLegacy=false` и primary не разрешён, вернёт blocked result.

Helper не подключён к production route.

### 21.9 Checks

`npm run check:constructor-core` теперь проверяет:

- `far_development_week_d90` -> `matrix_allowed_for_primary`;
- `post_competition_day` -> `matrix_allowed_for_primary`;
- `travel_day` -> `matrix_allowed_for_internal`;
- `weigh_in_day` -> `matrix_allowed_for_internal`;
- `main_start_d28` -> `preview_only`;
- `main_start_d21` -> `preview_only`;
- `main_start_d10` -> `preview_only`;
- `main_start_d3` -> `preview_only`;
- `competition_day` -> `preview_only`;
- `unknown` -> `legacy_only`/blocked with explicit blocker;
- `buildMatrixConstructorDraftIfAllowed`;
- no input mutation;
- default `buildPerformConstructorDraft` remains legacy.

### 21.10 Что намеренно не изменено

Не изменены:

- `buildPerformConstructorDraft`;
- `selectTemplateCards`;
- `mergeWeeks`;
- `pickSourceWeekForPhase`;
- production `POST /api/v1/plans/constructor/draft`;
- DB schema;
- default UI flow;
- mobile contracts;
- storage/telemetry.

### 21.11 Следующий PR

Следующий controlled PR:

1. Добавить badge в internal preview panel:
   - `Matrix primary allowed`;
   - `Preview only`;
   - `Blocked`.
2. Добавить internal-only кнопку `Use matrix draft for preview only` без сохранения в DB.
3. Начать limited rollout только для:
   - far development;
   - post-competition recovery;
   - logistics scenarios.
4. Только после feedback обсуждать изменение production behavior.

## 22. Stage 11: Rollout decision in internal UI

### 22.1 Где находится UI

UI добавлен в уже существующую internal panel:

```text
apps/web/app/page-client.tsx
```

Панель:

```text
Matrix preview / internal
Сравнение legacy vs matrix - internal
```

Она остаётся collapsed по умолчанию и находится внутри Planning Studio constructor view.

### 22.2 Какие endpoints вызывает panel

Одна internal action-кнопка запускает два независимых запроса:

```http
POST /api/v1/plans/constructor/internal/matrix-preview
POST /api/v1/plans/constructor/internal/matrix-rollout-decision
```

Если rollout endpoint падает, preview остаётся видимым.
Если preview endpoint падает, rollout error показывается отдельно.

### 22.3 Что показывает rollout decision block

Новый блок `Rollout decision` показывает:

- `mode`;
- `scenario`;
- `recommendedAction`;
- `matrixPrimaryAllowed`;
- `allowlisted`;
- `safeToPreview`;
- blockers count;
- explanation headline/reasons/next step;
- blockers list with code/severity/message/details.

Badge mapping:

- `matrix_allowed_for_primary` -> `Matrix primary allowed`;
- `matrix_allowed_for_internal` -> `Matrix internal only`;
- `preview_only` -> `Preview only`;
- `legacy_only` -> `Legacy default`;
- `blocked` -> `Blocked`.

### 22.4 Read-only matrix primary candidate

Добавлена секция:

```text
Matrix primary candidate - read-only
```

Она видна только если:

- rollout mode = `matrix_allowed_for_primary` или `matrix_allowed_for_internal`;
- matrix draft есть в preview response;
- `safeToPreview=true`;
- `defaultPathUnchanged=true`.

Секция показывает:

- week/day/session/block counts;
- selected block overview;
- load summary;
- risk summary;
- matrix explanations.

Явная подпись:

```text
Внутренний read-only кандидат. Не сохраняется и не заменяет основной черновик.
```

### 22.5 Что не изменено

Stage 11 не меняет:

- `buildPerformConstructorDraft`;
- `selectTemplateCards`;
- `mergeWeeks`;
- `pickSourceWeekForPhase`;
- production `POST /api/v1/plans/constructor/draft`;
- save/template/assign flow;
- DB schema;
- mobile contracts;
- localStorage/sessionStorage;
- telemetry.

Основной `constructorDraft` state остаётся legacy/main draft state.
Matrix candidate не подставляется в `constructorTemplatePayload` и не даёт кнопки сохранения.

### 22.6 Preview-only policy

D-28/D-21/D-10/D-3 главного старта и competition day остаются `preview_only`.
UI показывает причину и скрывает read-only primary candidate для этих сценариев.

### 22.7 Manual verification

Для stage 11 требуется browser/manual check affected flow:

1. Internal panel collapsed by default.
2. Main draft generation still works.
3. Matrix preview loads.
4. Rollout decision loads.
5. Badge/status visible.
6. Read-only candidate visible only for allowed primary/internal scenarios.
7. Preview-only/blocked scenarios hide candidate.
8. Save/template/assign buttons do not save matrix candidate.

### 22.8 Следующий PR

Следующий controlled PR:

- internal “use matrix draft in preview workspace” без сохранения в DB;
- или feature flag для visibility панели;
- или сбор QA feedback по allowlisted сценариям;
- затем limited production primary mode только для far development/post-competition/logistics after feedback.

## 23. Stage 12: Internal matrix preview workspace

Stage 12 добавляет в internal constructor panel безопасный workspace, где можно временно открыть matrix candidate как визуальный draft.

Это не production rollout и не замена legacy generator.

### 23.1 Где находится workspace

UI:

```text
apps/web/app/page-client.tsx
```

Styles:

```text
apps/web/app/globals.css
```

Кнопка появляется в блоке `Rollout decision`:

```text
Показать matrix-кандидат в preview workspace
```

После открытия появляется отдельная секция:

```text
Internal matrix preview workspace
Matrix-кандидат черновика
```

### 23.2 Когда workspace доступен

Открытие разрешено только если одновременно:

- rollout mode = `matrix_allowed_for_primary` или `matrix_allowed_for_internal`;
- `matrixPrimaryAllowed=true` или mode = `matrix_allowed_for_internal`;
- `preview.safeToPreview=true`;
- `preview.defaultPathUnchanged=true`;
- matrix draft есть в preview response;
- safety errors отсутствуют;
- rollout error blockers отсутствуют.

Для `preview_only`, `legacy_only` и `blocked` кнопка disabled и показывает причину.
D-28/D-21/D-10/D-3 главного старта остаются preview-only.

### 23.3 Что показывает workspace

Workspace показывает:

- mode/scenario/safe/default status;
- read-only/not saved/does not replace legacy badges;
- weeks/days/sessions/blocks counts;
- recommended action и объяснение, почему это не основной draft;
- rollout blockers, если они есть;
- risk flags matrix candidate;
- plan-level explanations;
- weeks/days/sessions/blocks в draft-compatible визуальном формате.

### 23.4 Read-only guards

Workspace намеренно не подключён к:

- `constructorDraft`;
- `constructorTemplatePayload`;
- `handleSaveConstructorTemplate`;
- save as template;
- assign plan;
- DB writes;
- localStorage/sessionStorage;
- mobile contracts.

В коде оставлен guard-comment рядом с renderer:

```text
Matrix workspace is display-only: never pass this draft to template/save/assign handlers.
```

При новом legacy draft или новом matrix preview workspace закрывается, чтобы старый matrix candidate не висел после изменения вводных.

### 23.5 Что не изменено

Stage 12 не меняет:

- `buildPerformConstructorDraft(input)`;
- `selectTemplateCards`;
- `mergeWeeks`;
- `pickSourceWeekForPhase`;
- production `POST /api/v1/plans/constructor/draft`;
- DB schema;
- save/template/assign flow;
- mobile contracts;
- telemetry/storage.

### 23.6 Manual verification

Для stage 12 manual/browser verification:

1. Legacy draft flow работает как раньше.
2. Internal panel запускает preview и rollout decision.
3. D-90/far development показывает `matrix_allowed_for_primary`, кнопка workspace активна.
4. Workspace открывается, показывает matrix draft и read-only badges.
5. В workspace нет save/template/assign controls.
6. Close возвращает к legacy draft.
7. Legacy draft остаётся доступным.
8. D-3/main start остаётся `preview_only`, workspace disabled.
9. Endpoint error не ломает основной draft.

### 23.7 Следующий PR

Следующий controlled PR после stage 12:

- controlled internal feedback capture без персональных данных;
- или feature flag for internal workspace visibility;
- или limited production pilot только для `far_development_week` / `post_competition_recovery`;
- но не full replacement of `mergeWeeks`.

## 24. Stage 13: Controlled internal matrix draft activation

Stage 13 добавляет поверх Stage 12 контролируемое действие:

```text
Использовать matrix как internal draft
```

Это не production rollout. Это временный UI-режим для внутренней проверки, где matrix candidate можно увидеть в основной draft-зоне конструктора, но нельзя сохранить, назначить или превратить в template payload.

### 24.1 UI state

В web UI добавлен источник активного черновика:

```ts
type ActiveConstructorDraftSource = "legacy" | "matrix_internal";
```

`activeConstructorDraftSource="legacy"` остаётся default. `matrix_internal` включается только вручную из открытого internal matrix workspace.

При новом legacy draft, новом matrix preview или изменении вводных constructor form режим сбрасывается обратно в `legacy`, а workspace закрывается.

### 24.2 Когда activation доступен

Activation разрешён только через тот же controlled gate, что и workspace:

- rollout mode = `matrix_allowed_for_primary` или `matrix_allowed_for_internal`;
- matrix draft есть в workspace;
- preview и rollout говорят `safeToPreview=true`;
- legacy default guard говорит `defaultPathUnchanged=true`;
- safety errors отсутствуют;
- rollout error blockers отсутствуют.

Для `preview_only`, `legacy_only`, `blocked`, missing matrix draft, safety/default guard errors activation disabled и показывает причину.

### 24.3 Read-only / no-save policy

Когда активен `matrix_internal`:

- основной draft panel показывает matrix candidate;
- сверху появляется banner `Matrix internal draft active`;
- save as template скрыт и заменён read-only note;
- `handleSaveConstructorTemplate` дополнительно проверяет `activeConstructorDraftSource`;
- `constructorTemplatePayload` не строится из matrix draft;
- legacy draft не мутируется;
- DB, localStorage, sessionStorage и mobile contracts не используются.

Кнопка:

```text
Вернуться к legacy draft
```

просто возвращает `activeConstructorDraftSource="legacy"` без API-запросов и без мутаций.

### 24.4 Что не изменено

Stage 13 не меняет:

- `buildPerformConstructorDraft(input)`;
- `selectTemplateCards`;
- `mergeWeeks`;
- `pickSourceWeekForPhase`;
- production `POST /api/v1/plans/constructor/draft`;
- DB schema;
- legacy save/template/assign flow;
- mobile contracts;
- telemetry/storage.

### 24.5 Manual verification target

Для stage 13 нужно проверить:

1. Legacy draft generation работает как раньше.
2. Legacy save as template доступен до matrix activation.
3. D-90/far development: workspace opens, activation enabled.
4. После activation основная draft-зона показывает `matrix_internal · read-only`.
5. Save/template/assign actions hidden/disabled for matrix source.
6. `Вернуться к legacy draft` возвращает legacy draft и save as template.
7. D-3/main start остаётся `preview_only`, workspace/activation disabled.
8. Console errors отсутствуют.

## 25. Stage 14: Matrix constructor UI decomposition

Stage 14 не добавляет новый продуктовый flow. Это refactor-only слой после controlled activation, чтобы `apps/web/app/page-client.tsx` оставался orchestration container, а matrix UI не превращал страницу в god-file.

### 25.1 Что вынесено

Pure UI helpers вынесены в:

```text
apps/web/app/lib/constructor-matrix-ui.ts
```

React UI вынесен в:

```text
apps/web/app/components/constructor/MatrixConstructorPreviewPanel.tsx
apps/web/app/components/constructor/MatrixRolloutDecisionCard.tsx
apps/web/app/components/constructor/MatrixPreviewWorkspace.tsx
apps/web/app/components/constructor/MatrixInternalDraftBanner.tsx
apps/web/app/components/constructor/MatrixDraftReadOnlyView.tsx
```

`page-client.tsx` оставляет у себя:

- constructor form state;
- legacy draft state;
- matrix preview / rollout / workspace state;
- `activeConstructorDraftSource`;
- high-level handlers;
- API calls;
- save/template guards.

### 25.2 Поведение Stage 13 сохранено

Stage 14 сохраняет 1-в-1:

- legacy draft остаётся default;
- matrix activation только manual;
- `matrix_internal` остаётся read-only;
- save/template/assign скрыты или заблокированы для matrix source;
- `handleSaveConstructorTemplate` продолжает иметь defensive guard;
- workspace доступен только через тот же controlled rollout gate;
- D-3/main start остаётся preview-only;
- возврат к legacy не делает API-запросов и не мутирует draft.

### 25.3 Что не изменено

Stage 14 не меняет:

- `buildPerformConstructorDraft(input)`;
- production `POST /api/v1/plans/constructor/draft`;
- internal API contracts;
- DB schema;
- mobile contracts;
- `mergeWeeks`;
- `selectTemplateCards`;
- `pickSourceWeekForPhase`;
- rollout allowlist/policy;
- save/template/assign semantics;
- localStorage/sessionStorage/telemetry.

### 25.4 Manual verification target

Для stage 14 нужно проверить тот же affected flow:

1. Legacy draft generation и save template доступны как раньше.
2. Internal matrix preview запускается из новой component panel.
3. D-90/far development открывает read-only workspace.
4. Activation показывает matrix draft в основной draft-зоне.
5. Save/template/assign hidden/disabled для `matrix_internal`.
6. Return to legacy восстанавливает legacy draft и save button.
7. D-3/main start остаётся preview-only и не открывает workspace.
8. Console errors отсутствуют.

## 26. Stage 15: Internal matrix constructor UI feature flag

Stage 15 добавляет controlled visibility gate для internal matrix constructor UI.

Это не rollout matrix logic. Это только UI visibility feature flag, чтобы internal preview/rollout/workspace/activation не были видны без явного включения.

### 26.1 Flag

Web flag:

```bash
NEXT_PUBLIC_INTERNAL_MATRIX_CONSTRUCTOR_UI=true
```

Допустимые enabled values:

- `1`;
- `true`;
- `enabled`;
- `on`.

Любое другое значение или отсутствие env означает `off`.

Flag не сохраняется в:

- localStorage;
- sessionStorage;
- DB;
- telemetry.

### 26.2 Что контролирует flag

При `off`:

- `MatrixConstructorPreviewPanel` не отображается;
- matrix preview button недоступен, потому что panel не mounted;
- `handleBuildConstructorMatrixPreview` делает early return;
- workspace open недоступен;
- internal activation недоступна;
- `matrix_internal` не может стать активным draft source;
- active matrix banner не отображается;
- legacy constructor generation/save/template flow работает как раньше.

При `on` поведение Stage 14 сохраняется:

- internal matrix preview visible;
- rollout decision visible;
- read-only workspace visible для allowed scenarios;
- manual internal activation доступна только через controlled gate;
- save/template/assign disabled для `matrix_internal`;
- return to legacy работает без API/storage mutations.

### 26.3 Что не изменено

Stage 15 не меняет:

- `buildPerformConstructorDraft(input)`;
- production `POST /api/v1/plans/constructor/draft`;
- internal API contracts;
- DB schema;
- mobile contracts;
- shared constructor core;
- `mergeWeeks`;
- `selectTemplateCards`;
- `pickSourceWeekForPhase`;
- rollout allowlist/policy;
- save/template/assign semantics.

### 26.4 Manual verification target

Проверить два режима.

Flag off:

1. Legacy draft generation работает.
2. Save as template виден для legacy draft.
3. Matrix preview panel hidden.
4. Console errors отсутствуют.

Flag on:

1. D-90/far development открывает workspace и включает internal activation.
2. `matrix_internal` показывает read-only draft и скрывает save/template/assign.
3. Return to legacy восстанавливает legacy draft и save button.
4. D-3/main start остаётся preview-only, workspace disabled.
5. Travel/weigh-in scenario остаётся `matrix_allowed_for_internal`.
6. Console errors отсутствуют.
