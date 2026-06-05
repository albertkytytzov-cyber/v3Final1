# PERFORM Cycle Builder: международная прикладная доказательная база

Версия: черновик v1, 2026-06-05

Цель: усилить методическую базу генератора циклов не просто ссылками на исследования, а источниками, которые можно перевести в рабочие правила: лимиты, протоколы, тесты, корректировки и предупреждения.

Связанные документы:

- `docs/perform-cycle-builder-methodology.md`
- `docs/perform-cycle-evidence-matrix.md`
- `docs/perform-wrestling-science-map.md`
- `docs/europe-2026-plan-analysis.md`

## Критерий отбора

Источник подходит для PERFORM, если из него можно взять хотя бы один рабочий элемент:

- протокол тренировки;
- частоту и длительность вмешательства;
- лимит безопасности;
- тестовую батарею;
- критерий риска;
- мониторинговую метрику;
- правило коррекции.

## 1. США / North America: правила безопасности, мониторинг и практические лимиты

### NCAA wrestling weight management

**Что даёт**

Это не просто исследование, а рабочая спортивная политика: контроль минимального веса, гидратации и скорости снижения массы. Для PERFORM это важный пример, как научный риск превращается в прикладное правило.

**Что переносим в PERFORM**

- максимальная безопасная скорость снижения веса как флаг риска;
- `weightDescentRate`;
- `hydrationCheckRequired`;
- запрет на автоматическое усиление нагрузки при резком снижении веса;
- отдельное предупреждение, если спортсмен пытается закрыть вес через обезвоживание.

**Рабочее правило**

```text
Если масса снижается быстрее допустимого порога или одновременно ухудшаются сон/RHR/readiness,
PERFORM не предлагает добор объёма и помечает день как weight-cut risk.
```

**Источники**

- NCAA Weight Management / 1.5% per week rule.
- NCAA: weight-loss science and wrestling weight management.

### ACSM hydration and nutrition

**Что даёт**

ACSM даёт прикладной уровень: не просто “пить воду”, а ограничивать чрезмерную потерю массы тела от водного дефицита, учитывать индивидуальную потливость, электролиты, углеводы и восстановление после тренировки.

**Что переносим в PERFORM**

- `hydrationRisk`;
- `acuteBodyMassLossPct`;
- `fuelingNeeded`;
- связь интенсивных дней с питанием/углеводами;
- предупреждение при обезвоживании перед техникой, спринтами, борьбой или весогонкой.

**Рабочее правило**

```text
Если за короткое окно масса упала >2% и нет данных, что это плановая коррекция,
PERFORM снижает уверенность анализа и не усиливает интервалы/контакт.
```

**Источники**

- ACSM Position Stand: Exercise and Fluid Replacement.
- ACSM Nutrition and Athletic Performance.

### NSCA / long-term athletic development

**Что даёт**

Для юных спортсменов важна не только победа в текущем цикле, а долгосрочная подготовка, прогрессия, индивидуализация и снижение риска перегруза.

**Что переносим в PERFORM**

- подростковые циклы должны иметь более строгие ограничения;
- `athleteAgeGroup`;
- `maturityContext`;
- запрет агрессивных шаблонов без подтверждения тренера;
- прогрессия нагрузки должна быть индивидуальной.

**Рабочее правило**

```text
Для подростков PERFORM не должен строить высокий объём ЛМВ/спринтов/контакта
без флага тренерского подтверждения и контроля восстановления.
```

**Источники**

- NSCA Position Statement on Long-Term Athletic Development.
- Youth resistance training consensus.

## 2. Япония: KAATSU/BFR, весогонка и контроль состава тела

### KAATSU / BFR как рабочий аналог локального метаболического стимула

**Что даёт**

Японская школа KAATSU и современный BFR-слой дают PERFORM международную опору для логики: низкая внешняя нагрузка может создавать значимый локальный стимул при ограничении кровотока/венозного оттока и метаболическом стрессе.

**Что переносим в PERFORM**

- не считать лёгкий вес автоматически лёгкой нагрузкой;
- `localMetabolicStress`;
- `constantTension`;
- `bloodFlowRestrictionLikeStimulus`;
- осторожность и противопоказания для настоящего BFR.

**Рабочее правило**

```text
Если блок имеет постоянное напряжение, локальное жжение и длительность 20-60 сек,
PERFORM учитывает локальный стресс даже при низкой внешней нагрузке.
```

**Источники**

- BFR Position Stand: methodology, application and safety.
- KAATSU/BFR athlete evidence reviews.

### Japanese wrestling rapid weight loss studies

**Что даёт**

Японские исследования по борцам показывают, что RWL можно измерять не только весом, а энергозатратами, водой тела и изменениями состава тела. Это важно для PERFORM: “вес упал” не означает “форма улучшилась”.

**Что переносим в PERFORM**

- `rapidWeightLossWindow`;
- `energyDeficitRisk`;
- `rehydrationIncomplete`;
- осторожность при интерпретации веса после взвешивания;
- связь веса с силой, гликогеном, восстановлением.

**Рабочее правило**

```text
Если вес резко снижается в последние 48-72 часа,
PERFORM показывает не только вес, но и риск: сила/гликоген/гидратация/сон.
```

**Источники**

- Energy Deficit Required for Rapid Weight Loss in Elite Collegiate Wrestlers.
- MRI evaluation of body composition changes in wrestlers undergoing rapid weight loss.

### Judo grip/dehydration as transferable grappling evidence

**Что даёт**

Дзюдо ближе к борьбе по хвату, контакту и весовым категориям, чем общая фитнес-литература. Исследования показывают, что обезвоживание и серия схваток ухудшают хват, верх, специальную работоспособность и субъективные реакции.

**Что переносим в PERFORM**

- `gripRecoveryDebt`;
- `upperLimbLocalFatigue`;
- `dehydrationGripRisk`;
- связь весогонки и работы рук/хвата.

**Рабочее правило**

```text
Если есть весогонка/обезвоживание и планируется хват/партер/клинч,
PERFORM предупреждает о риске снижения силы хвата и качества контакта.
```

**Источники**

- Acute Dehydration Impairs Performance and Physiological Responses in Highly Trained Judo Athletes.
- Official judo match handgrip studies.

## 3. Китай: прикладные тренировочные протоколы у борцов

### BFR + high-intensity half squat у юных борчих

**Что даёт**

Китайское RCT по adolescent female wrestlers даёт очень рабочий протокол: 6 недель, 3 тренировки в неделю, комбинация низкоинтенсивного BFR half squat и высокоинтенсивного half squat. Комбинированная стратегия улучшала показатели силы/скорости развития усилия нижних конечностей.

**Что переносим в PERFORM**

- шаблон `legs_lme_bfr_like_6w`;
- отдельная версия для юных спортсменок с осторожностью;
- связь ЛМВ ног с RFD, прыжком, коленным разгибанием/сгибанием;
- более строгий контроль безопасности.

**Рабочее правило**

```text
Для развития ног можно строить 6-недельный блок:
2 сессии низкоинтенсивного локального стимула + 1 сессия силовой работы в неделю,
но только при нормальном восстановлении и без боли в колене/тазу/спине.
```

**Источник**

- Combined low intensity blood flow restriction and high intensity half squat training improves lower limb force development in adolescent wrestlers.

### Short sprint interval training у молодых борцов

**Что даёт**

Китайское исследование из Wuhan Sports University: 7-недельный SSIT у молодых борцов в предсезонной фазе улучшал 20-м спринт, 4x9 shuttle, максимальную силу, VO2max, peak/mean power. Важный практический вывод: и прогрессивная, и непрогрессивная схемы дали сходные адаптации; важнее общий рабочий объём и контроль реакции.

**Что переносим в PERFORM**

- шаблон `sprint_interval_preseason_7w`;
- не обязательно всегда повышать повторы каждую неделю;
- отслеживать RPE/GPS/дистанцию, если есть;
- не ставить как “автоматический” блок без восстановления ног.

**Рабочее правило**

```text
SSIT ставится как предсезонный/развивающий блок.
Если ноги уже локально перегружены или сон плохой, блок заменяется на аэробную поддержку или технику.
```

**Источник**

- Comparative Analysis of Adaptive Changes in Immunoendocrine and Physiological Responses to High-Intensity Sprint Interval Training with Progressive and Nonprogressive Loads in Young Wrestlers.

### Sichuan freestyle wrestling weight-reduction study

**Что даёт**

Исследование мужских freestyle wrestlers из Sichuan Province связывает периоды slow/rapid weight loss с физиологическими, психологическими и sleep quality параметрами. Там есть прикладная батарея: morning HR, blood pressure, body composition, blood indicators, psychological assessments, sleep quality, anaerobic power.

**Что переносим в PERFORM**

- `weightCutMonitoringPanel`;
- обязательная связка: вес + утренний пульс + сон + настроение/усталость + анаэробная мощность;
- не оценивать весогонку только по массе тела.

**Рабочее правило**

```text
Если идёт период снижения веса, PERFORM требует минимум:
вес, утренний пульс, сон, готовность/усталость, комментарий тренера.
Без этого общий ИИ-разбор периода помечается как ограниченный.
```

**Источник**

- Influence of slow and rapid weight loss periods on physiological performance, mood state and sleep quality in male freestyle wrestlers: a study from Sichuan Province, China.

### Physiological profile of elite Chinese female wrestlers

**Что даёт**

Это не готовый тренировочный цикл, но полезная тестовая батарея: VO2max, 3200 м, 400 м, Wingate, isokinetic torque, 1RM. Для PERFORM это база профилирования спортсменки и определения слабых мест.

**Что переносим в PERFORM**

- `athleteProfileBattery`;
- сравнение спортсменки не только по весу/готовности, но по энергетике, силе, мощности и изокинетике;
- персонализация генератора циклов.

**Рабочее правило**

```text
Если профиль показывает слабую анаэробную мощность, генератор может предложить интервалы.
Если слабая локальная сила ног/таза, приоритет получает ЛМВ/силовой перенос.
```

**Источник**

- Physiological profile of elite Chinese female wrestlers.

## 4. Что меняем в PERFORM Evidence Matrix

Нужно добавить отдельный слой `operationalEvidence`, чтобы отличать:

- исследование с прямым протоколом;
- консенсус/position stand;
- спортивную политику безопасности;
- тренерскую методику;
- переносимую evidence из дзюдо/грэпплинга;
- внутреннюю валидацию PERFORM.

Пример:

```json
{
  "method": "sprint_interval_preseason_7w",
  "evidenceType": "direct_training_intervention",
  "region": "China",
  "population": "young freestyle wrestlers",
  "durationWeeks": 7,
  "transferToPerform": [
    "preseason_sprint_interval_template",
    "monitor_rpe",
    "avoid_after_heavy_legs"
  ]
}
```

## 5. Новые шаблоны, которые можно создать из этой базы

| Шаблон | Основание | Статус |
|---|---|---|
| `legs_bfr_like_6w` | China RCT + BFR/KAATSU position stand | только после тренерского утверждения |
| `sprint_interval_preseason_7w` | China SSIT wrestler study + combat HIIT meta-analysis | хороший кандидат |
| `weight_cut_monitoring_panel` | NCAA/ACSM + Sichuan freestyle wrestling study + Japan RWL studies | высокий приоритет |
| `grip_dehydration_risk` | judo dehydration/grip studies | переносимая evidence |
| `youth_safe_progression` | NSCA LTAD + youth resistance statements | обязательный слой для подростков |

## 6. Практический вывод для генератора

PERFORM должен строить цикл не только по цели `развить ноги/руки`, а по типу доказательной базы:

```text
Если есть прямой протокол у борцов -> можно предложить как шаблон.
Если есть систематический обзор по единоборствам -> можно сделать правило.
Если есть политика безопасности NCAA/ACSM -> можно сделать ограничение.
Если есть перенос из дзюдо -> использовать как осторожный grappling evidence.
Если это тренерская методика -> показывать как уровень C и требовать подтверждение.
```

Так генератор будет не “красиво строить план”, а объяснять:

- почему этот цикл выбран;
- откуда взялись ограничения;
- какие данные нужны;
- где риск;
- что тренер может изменить.

## Источники

- NCAA: Weight loss in wrestling, current state of the science: https://www.ncaa.org/sports/2014/9/11/weight-loss-in-wrestling-current-state-of-the-science
- NCAA Weight Management Program Packet: https://ncaaorg.s3.amazonaws.com/championships/sports/wrestling/rules/2024-25PRMWR_WeightManagementProgramPacket.pdf
- ACSM Exercise and Fluid Replacement: https://pubmed.ncbi.nlm.nih.gov/17277604/
- ACSM Nutrition and Athletic Performance: https://pubmed.ncbi.nlm.nih.gov/?term=19225360
- NSCA Long-Term Athletic Development: https://pubmed.ncbi.nlm.nih.gov/26933920/
- BFR methodology/application/safety position stand: https://pubmed.ncbi.nlm.nih.gov/31156448/
- Chinese female wrestler BFR/half-squat RCT: https://pubmed.ncbi.nlm.nih.gov/40467774/
- Chinese SSIT freestyle wrestler study: https://jssm.org/volume23/iss2/cap/jssm-23-455.pdf
- Sichuan freestyle wrestler weight reduction study: https://www.frontiersin.org/articles/10.3389/fpsyg.2024.1445810/full
- Energy deficit required for RWL in elite collegiate wrestlers: https://pubmed.ncbi.nlm.nih.gov/29701639/
- MRI body composition in Japanese wrestlers during RWL: https://cir.nii.ac.jp/crid/1360011143821073792
- Acute dehydration and judo-specific performance: https://pmc.ncbi.nlm.nih.gov/articles/PMC9220037/
- Physiological profile of elite Chinese female wrestlers: https://pubmed.ncbi.nlm.nih.gov/23238092/
