# PERFORM Sync / Gadgetbridge Experimental Adapter

Обновлено: 2026-05-27

## Решение

Для быстрой проверки часов Xiaomi делаем экспериментальный контур на логике
Gadgetbridge. Цель - не гадать по симптомам, а проверить реальный эталонный
pipeline:

1. auth;
2. fetch today;
3. fetch past;
4. очередь file ID;
5. чтение файла по chunks;
6. CRC;
7. parser;
8. сохранение результата;
9. ACK.

## Важная граница AGPL

Код Gadgetbridge под AGPLv3. Поэтому экспериментальный контур должен быть явно
отделен от обычного PERFORM-кода.

Для теста допустимо:

- держать код в отдельном Android-модуле/пакете;
- сохранить copyright/license headers;
- добавить NOTICE, что компонент основан на Gadgetbridge;
- не включать этот путь в production без отдельного решения.

Нельзя делать незаметно:

- копировать Gadgetbridge-классы в основной пакет PERFORM как обычный закрытый
  код;
- удалять AGPL headers;
- выпускать APK с этим кодом как закрытый production build.

## Почему отдельный контур лучше прямого копирования

Gadgetbridge - не библиотека, а полноценное Android-приложение. Xiaomi-стек
зависит от:

- protobuf lite и `xiaomi.proto`;
- собственного transport layer;
- `XiaomiSupport`, services, coordinators;
- activity parsers;
- DB/sample providers;
- utilities и logging;
- Android service lifecycle.

Если переносить всё внутрь PERFORM сразу, можно быстро сломать сборку и
перемешать production-код с AGPL. Экспериментальный контур позволяет сначала
проверить часы, а потом решить, оставлять AGPL-компонент или переписать чистую
реализацию по подтвержденной логике.

## Минимальный адаптер для проверки

Первая версия должна отдавать в PERFORM не UI, а диагностический JSON:

- список файлов из часов;
- по каждому файлу:
  - `idHex`;
  - timestamp/timezone;
  - type/subtype/detail/version;
  - chunks total/read;
  - CRC status;
  - parser name;
  - parsed metrics;
  - ACK status;
- итог дня:
  - пульс;
  - SpO2;
  - стресс;
  - сон;
  - тренировки;
  - ошибки парсеров.

## Что берем из Gadgetbridge как эталон

Основной поток:

- `XiaomiHealthService`
- `XiaomiActivityFileFetcher`
- `XiaomiActivityFileId`
- activity parsers:
  - `DailyDetailsParser`
  - `DailySummaryParser`
  - `SleepDetailsParser`
  - `SleepStagesParser`
  - `ManualSamplesParser`
  - `WorkoutSummaryParser`
  - `WorkoutGpsParser`

Transport/auth:

- `XiaomiSppProtocolV2`
- `XiaomiSppPacketV2`
- `XiaomiAuthService`
- Xiaomi protobuf model from `xiaomi.proto`

## Что не берем на первом этапе

- UI Gadgetbridge;
- база Gadgetbridge;
- device coordinator;
- OpenTracks/GPS phone workout logic;
- firmware/watchface/music/calendar/contact services;
- карты и внешние integrations.

## Сверка Gadgetbridge -> PERFORM, 25-26.05.2026

Эта секция нужна как рабочая карта, чтобы дальше не гадать по симптомам.
Gadgetbridge используем как эталон поведения протокола, но код не переносим
дословно в основной PERFORM из-за AGPL.

`_external/notify-mi` проверен отдельно: это не Android-клиент Notify for
Xiaomi и не источник по BLE/Xiaomi-протоколу. Для сверки используем
Gadgetbridge и реальные DirectWatch-логи.

| Слой | Gadgetbridge | PERFORM Sync | Статус |
| --- | --- | --- | --- |
| Запрос списка файлов | `XiaomiHealthService`: `today -> past` | `readDirectWatchDailySync(... includeHistory=true)` и native `today/past` | совпадает |
| Команды файлов | `type=8`, `subtype=1/2/3/5`, Health fields `2/3/5` | `buildActivityFetchTodayCommand`, `buildActivityFetchRequestCommand`, `buildActivityFetchAckCommand` | совпадает |
| ID файла | `XiaomiActivityFileId`: 7 байт, timestamp/tz/version/flags | `parseClassicActivityFileIds` | совпадает |
| Очередь чтения | `PriorityQueue`, один файл за раз | `requestClassicActivityFilesSequentially`, один файл за раз | совпадает |
| Chunks | `uint16 total`, `uint16 num`, payload c byte 4 | `parseClassicActivityChunk`, `readClassicActivityFileUntil` | совпадает |
| CRC | CRC32 по файлу без последних 4 байт | `classicActivityCrcValid` | совпадает |
| ACK | Gadgetbridge ACK после CRC/parser, по настройке может держать файл на часах | PERFORM ACK только после API save или flush queue | намеренно строже |
| Сортировка | timestamp + detail order: summary -> details -> GPS | date distance + file order: daily, sleep, manual, sports summary/details/GPS | рабочее, но можно сблизить по group order |
| Лимит | очереди без жесткого общего лимита в parser-слое | `CLASSIC_ACTIVITY_FILE_PROBE_LIMIT = 512` | рабочий запас, но правильнее уйти к date-scoped очереди без общего потолка |
| Daily details | v1/v2/v3/v4 | v1/v2/v3/v4 | совпадает |
| Daily summary | v3/v5 | v3/v5 | совпадает по основной схеме |
| Manual samples | v2 HR/SpO2/stress/temp | v2 HR/SpO2/stress, temp пропускается | достаточно для текущей модели |
| Sleep details | v1/v2/v3/v4/v5 | v1/v2/v3/v4/v5 после правки 25.05 | совпадает по основной схеме |
| Sleep stages | subtype 3, v2 | subtype 3, v2 | совпадает |
| Workout summary | много subtype: freestyle, walking, cycling, treadmill и т.д. | точные parser для всех основных subtype/version из `WorkoutSummaryParser` | совпадает по summary-слою |
| Workout GPS | versions 1/2 | versions 1/2 | совпадает |
| Workout details | Gadgetbridge sports details не парсит | PERFORM парсит walking v2/freestyle по raw-файлам | собственная экспериментальная часть |
| Time sync | system clock + timezone `sint32` blocks | `buildSetCurrentTimeCommand`, `sint32` blocks | совпадает |
| Weather | current + daily + hourly + location list + temp prefs | current + daily + hourly + location/order/prefs/bridge refresh | совпадает по базовой схеме |
| Background events | Android service/lifecycle + reconnect-driven sync | `DirectWatchSyncCoordinator`: service timer, app visible, unlock, Bluetooth on/reconnect, package/boot | совпадает по событийному подходу, API save оставлен в WebView |

### Фоновая синхронизация, 27.05.2026

По структуре оставляем ту же модель, что и у эталонных клиентов: native-слой
отвечает за lifecycle/Bluetooth-события, WebView - за UI и сохранение в API.

Что уточнено в PERFORM:

- pending native request больше не теряется, если WebView занят ручной,
  исторической или текущей синхронизацией: он повторяется через 15 секунд;
- `syncService` переводит coordinator в `started` только после проверки
  Bluetooth, `deviceId` и системного сопряжения;
- успешное обновление служебного канала часов (время/погода) считается
  успешным автозапуском даже без новых daily/workout-файлов;
- статус coordinator отображается в настройках часов: причина блокировки,
  pending request, `retryAfterMs`, последняя успешная синхронизация;
- ACK остается строже, чем в Gadgetbridge: только после API save/offline queue,
  чтобы часы не удаляли файл до сохранения в PERFORM.

### Workout summary coverage

Сверка по `WorkoutSummaryParser` Gadgetbridge и
`DirectWatchPlugin.parseClassicKnownWorkoutSummary`.

| Sports subtype | Значение | Gadgetbridge versions | PERFORM versions | Статус |
| --- | ---: | --- | --- | --- |
| Outdoor running / walking v1 | `1`, `2` | `4` | `4` | совпадает |
| Treadmill | `3` | `5`, `10`, `11` | `5`, `10`, `11` | совпадает |
| Outdoor cycling v1 | `6` | `4`, `5`, `6` | `4`, `5`, `6` | совпадает |
| Indoor cycling | `7` | `8`, `9` | `8`, `9` | совпадает |
| Freestyle | `8` | `5`, `7`, `8`, `9`, `10` | `5`, `7`, `8`, `9`, `10` | совпадает |
| Pool swimming | `9` | `6`, `7`, `8` | `6`, `7`, `8` | совпадает |
| Elliptical | `11` | `3`, `4`, `5`, `6` | `3`, `4`, `5`, `6` | совпадает |
| Rowing | `13` | `4`, `6`, `7` | `4`, `6`, `7` | совпадает |
| Jump rope | `14` | `3`, `5` | `3`, `5` | совпадает |
| HIIT | `16` | `5` | `5` | совпадает |
| Outdoor walking v2 | `22` | `1`, `4`, `5`, `6`, `9` | `1`, `4`, `5`, `6`, `9` | совпадает |
| Outdoor cycling v2 | `23` | `4` | `4` | совпадает |

Следующий реальный риск теперь не summary-parser, а sports DETAILS: Gadgetbridge
не дает готового parser для этих файлов, поэтому пульсовые точки внутри
тренировки остаются нашей экспериментальной частью. Их проверяем только по
raw-файлам, CRC, длине, количеству samples и совпадению min/avg/max с summary.

### Xiaomi workout type groups

`XiaomiWorkoutType.java` в Gadgetbridge содержит много конкретных видов спорта.
В PERFORM они сгруппированы в profile-slug'и, чтобы UI не требовал лишние
параметры там, где часы физически их не дают.

| Группа PERFORM | Коды Xiaomi | Что показываем обязательно |
| --- | --- | --- |
| `outdoor-run`, `outdoor-walk` | `1`, `2`, `15`, `207` | длительность, ЧСС, калории, дистанция, шаги, темп |
| `hiking`, `outdoor-sport`, `athletics` | `3`, `4`, `5`, `200-206`, `802`, `10000-10002` | длительность, ЧСС, калории, дистанция если есть |
| `outdoor-cycling` | `6` | длительность, ЧСС, калории, дистанция, скорость |
| `indoor-cycling` | `7`, `324` | длительность, ЧСС, калории; дистанцию не требуем |
| `freestyle`, `hiit`, `strength`, `boxing`, `wrestling`, `martial-arts`, `combat`, `yoga`, `dance` | `8`, `12`, `16`, `303-333`, `399-511` | длительность, ЧСС, калории, зоны; дистанцию и шаги не требуем |
| `pool-swim` | `9` | длительность, калории, дистанция/дорожки, гребки, SWOLF |
| `water-sport`, `water-polo` | `10`, `100-115` | длительность, ЧСС, калории, дистанция если есть |
| `elliptical` | `11`, `300-302`, `325` | длительность, ЧСС, калории, шаги/каденс если есть |
| `rowing` | `13` | длительность, ЧСС, калории, гребки |
| `jump-rope` | `14` | длительность, ЧСС, калории, прыжки |
| `field-sport`, `winter-sport`, `static` | `600-627`, `700-709`, `800`, `801`, `806`, `811`, `900-904` | длительность, ЧСС, калории; дистанцию не требуем |

Если нужно красивое русское название каждого конкретного вида спорта, это
отдельный UX-слой. Для логики параметров важнее профиль: нужен ли типу
дистанционный блок, шаги, темп, скорость, гребки, прыжки или только
время/пульс/калории.

Проверка 26.05.2026: в коде добавлен отдельный профиль `outdoor-variable`.
Он используется для `hiking`, `outdoor-sport` и `athletics`: длительность,
ЧСС и калории остаются базой, а дистанция, шаги, темп, скорость, GPS,
каденс и набор высоты показываются только если часы реально их отдали.
Для `elliptical` шаги также переведены из обязательных в дополнительные.

Практические выводы:

1. Если часы не отдали тренировку в текущем inventory, это не ошибка parser.
   Нужно смотреть `breakdown` и наличие `type=1` файлов.
2. Если пришел sleep file версии 5, старая версия PERFORM его отбрасывала.
   25.05 parser сна расширен до v5 по схеме Gadgetbridge.
3. Если пришел daily summary версии 3, старая версия PERFORM его отбрасывала.
   27.05 parser дневного итога расширен до v3/v5: v3 сохраняет шаги,
   калории, ЧСС, стресс и SpO2, а поля training load/vitality остаются пустыми,
   потому что в v3 их нет.
4. Для новых видов тренировок правильный путь такой:
   `activityFileProbeRequests -> rawHex -> subtype/version -> сверка с
   WorkoutSummaryParser -> собственный parser -> тест на свежей тренировке`.
5. По summary-слою основные виды уже закрыты. Если новый subtype/version
   появится в логах, добавлять его только после сверки с raw-файлом и
   Gadgetbridge, а не по похожим числам.
6. Прямого готового parser для sports DETAILS в Gadgetbridge нет. Пульс внутри
   тренировки из details остается нашей частью и должен проверяться только по
   raw-файлам + совпадению min/avg/max с summary.
7. Следующий технический долг - убрать фиксированный лимит `512` и сделать
   date-scoped чтение очереди до исчерпания нужных файлов.

## Проверка успеха

Считаем эксперимент успешным, если на реальном Redmi Watch 5:

- видим тот же список file ID, что ждёт Mi Fitness/Gadgetbridge;
- файлы читаются по одному без зависаний;
- CRC сходится;
- sleep/manual/workout parsers возвращают данные;
- ACK убирает только успешно сохраненные файлы;
- повторная синхронизация не дублирует уже подтвержденные файлы.

## Фактическая проверка 24.05.2026

Gadgetbridge full debug build установлен на подключенный Android и проверен на
Redmi Watch 5 `D4:A3:65:CE:0F:FE`.

Что подтвердилось:

- часы подключаются и отдают данные;
- главный экран Gadgetbridge после sync показал `10273` шагов и `6.9 km`;
- база Gadgetbridge содержит:
  - `4849` поминутных activity samples;
  - `5` дневных итогов;
  - `109` sleep stage samples;
  - `3` sleep sessions;
  - `25` manual samples;
  - `1` workout summary;
- сырых файлов сохранено `71`;
- среди файлов есть daily details, daily summary, manual samples, sleep
  summary, workout details, workout summary и workout GPS track.

Вывод:

- эталонный pipeline подтвержден на реальных часах;
- PERFORM Sync нужно доводить не через догадки UI, а через тот же порядок:
  `today -> past -> очередь -> chunks -> CRC -> parser -> API save -> ACK`;
- фиксированный лимит `64` уже выглядел пограничным, потому что эталонный
  клиент увидел `71` raw file; в PERFORM лимит поднят до `512`, но правильное
  production-решение все равно date-scoped очередь без общего потолка;
- в PERFORM уже перенесены безопасный ACK, parser manual samples, parser
  workout GPS track v1/v2 и summary-parser coverage основных sports subtype;
- следующий практический шаг - проверить следующий свежий workout на реальных
  часах и разбирать только те новые subtype/версии sleep/details, которые
  появятся в `activityFileProbeRequests`.

## Production-решение после теста

После проверки есть два пути:

1. Оставить AGPL-компонент отдельным открытым модулем/приложением и соблюдать
   требования лицензии.
2. Использовать результаты теста как спецификацию и довести собственную
   реализацию PERFORM Sync без копирования кода.
