# PERFORM Sync / Gadgetbridge Experimental Adapter

Обновлено: 2026-05-24

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

## Сверка Gadgetbridge -> PERFORM, 25.05.2026

Эта секция нужна как рабочая карта, чтобы дальше не гадать по симптомам.
Gadgetbridge используем как эталон поведения протокола, но код не переносим
дословно в основной PERFORM из-за AGPL.

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
| Лимит | очереди без жесткого общего лимита в parser-слое | `CLASSIC_ACTIVITY_FILE_PROBE_LIMIT = 128` | риск: надо убрать фиксированный потолок |
| Daily details | v1/v2/v3/v4 | v1/v2/v3/v4 | совпадает |
| Daily summary | v3/v5 | v5 | пробел: v3 нужен при появлении в логах |
| Manual samples | v2 HR/SpO2/stress/temp | v2 HR/SpO2/stress, temp пропускается | достаточно для текущей модели |
| Sleep details | v1/v2/v3/v4/v5 | v1/v2/v3/v4/v5 после правки 25.05 | совпадает по основной схеме |
| Sleep stages | subtype 3, v2 | subtype 3, v2 | совпадает |
| Workout summary | много subtype: freestyle, walking, cycling, treadmill и т.д. | точные parser пока freestyle и walking v2; остальное fallback | главный пробел тренировок |
| Workout GPS | versions 1/2 | versions 1/2 | совпадает |
| Workout details | Gadgetbridge sports details не парсит | PERFORM парсит walking v2/freestyle по raw-файлам | собственная экспериментальная часть |
| Time sync | system clock + timezone `sint32` blocks | `buildSetCurrentTimeCommand`, `sint32` blocks | совпадает |
| Weather | current + daily + hourly + location list + temp prefs | current + daily + hourly + location/order/prefs/bridge refresh | совпадает по базовой схеме |

Практические выводы:

1. Если часы не отдали тренировку в текущем inventory, это не ошибка parser.
   Нужно смотреть `breakdown` и наличие `type=1` файлов.
2. Если пришел sleep file версии 5, старая версия PERFORM его отбрасывала.
   25.05 parser сна расширен до v5 по схеме Gadgetbridge.
3. Для новых видов тренировок правильный путь такой:
   `activityFileProbeRequests -> rawHex -> subtype/version -> сверка с
   WorkoutSummaryParser -> собственный parser -> тест на свежей тренировке`.
4. Прямого готового parser для sports DETAILS в Gadgetbridge нет. Пульс внутри
   тренировки из details остается нашей частью и должен проверяться только по
   raw-файлам + совпадению min/avg/max с summary.
5. Следующий технический долг - убрать фиксированный лимит `128` и сделать
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
- фиксированный лимит `64` уже выглядит пограничным, потому что эталонный клиент
  увидел `71` raw file;
- в PERFORM уже перенесены безопасный ACK, parser manual samples, parser
  workout GPS track v1/v2 и walking v2 summary parser;
- следующий практический шаг - проверить следующий свежий workout на реальных
  часах и закрыть parser coverage для новых subtype/версий sleep, если они
  появятся в `activityFileProbeRequests`.

## Production-решение после теста

После проверки есть два пути:

1. Оставить AGPL-компонент отдельным открытым модулем/приложением и соблюдать
   требования лицензии.
2. Использовать результаты теста как спецификацию и довести собственную
   реализацию PERFORM Sync без копирования кода.
