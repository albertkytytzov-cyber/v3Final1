# PERFORM Sync / Xiaomi Watch Research

Обновлено: 2026-05-26

Это рабочая техническая записка по PERFORM Sync. Держим ее в проекте, чтобы
дальше не гадать по симптомам интерфейса, а проверять конкретные места:
авторизацию, список файлов, куски файлов, CRC, парсеры, сохранение и графики.

## Локальные источники

- `_external/notify-mi` - скачан из `https://github.com/dozy-programmer/notify-mi`.
  Это не Android-приложение Notify for Xiaomi. Репозиторий не относится к
  Xiaomi-часам, его не используем для протокола.
- `_external/Gadgetbridge` - скачан с Codeberg как открытый технический
  ориентир по Xiaomi/Huami-устройствам.
- `1778425134325log/` - логи Mi Fitness с реального телефона. Это главный
  ориентир по тому, какие file ID и статусы использует официальное приложение.
- Важно по лицензии: Gadgetbridge под AGPLv3. Его можно изучать как карту
  поведения протокола, но нельзя просто копировать код в PERFORM без понимания
  последствий лицензии. Для PERFORM правильнее делать чистую собственную
  реализацию.

## Карта Gadgetbridge

Основные файлы:

- `_external/Gadgetbridge/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/service/devices/xiaomi/XiaomiAuthService.java`
- `_external/Gadgetbridge/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/service/devices/xiaomi/XiaomiUuids.java`
- `_external/Gadgetbridge/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/service/devices/xiaomi/XiaomiBleProtocolV1.java`
- `_external/Gadgetbridge/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/service/devices/xiaomi/XiaomiBleProtocolV2.java`
- `_external/Gadgetbridge/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/service/devices/xiaomi/XiaomiSppProtocolV1.java`
- `_external/Gadgetbridge/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/service/devices/xiaomi/XiaomiSppProtocolV2.java`
- `_external/Gadgetbridge/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/service/devices/xiaomi/services/XiaomiHealthService.java`
- `_external/Gadgetbridge/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/service/devices/xiaomi/services/XiaomiWeatherService.java`
- `_external/Gadgetbridge/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/service/devices/xiaomi/activity/XiaomiActivityFileFetcher.java`
- `_external/Gadgetbridge/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/service/devices/xiaomi/activity/XiaomiActivityFileId.java`
- `_external/Gadgetbridge/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/service/devices/xiaomi/activity/impl/DailyDetailsParser.java`
- `_external/Gadgetbridge/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/service/devices/xiaomi/activity/impl/DailySummaryParser.java`
- `_external/Gadgetbridge/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/service/devices/xiaomi/activity/impl/SleepDetailsParser.java`
- `_external/Gadgetbridge/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/service/devices/xiaomi/activity/impl/ManualSamplesParser.java`
- `_external/Gadgetbridge/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/service/devices/xiaomi/activity/impl/WorkoutSummaryParser.java`
- `_external/Gadgetbridge/app/src/main/java/nodomain/freeyourgadget/gadgetbridge/service/devices/xiaomi/activity/impl/WorkoutGpsParser.java`

Ключевые части протокола:

- Xiaomi-устройства могут работать через BLE v1, BLE v2, Classic SPP или
  Classic SPP v2. Это зависит от модели и прошивки.
- BLE v2 использует сервис FE95 и характеристики `0000005e` / `0000005f`.
- BLE v1 на зашифрованных устройствах использует FE95 и характеристики
  `51/52/53/55`.
- Новые часы требуют 16-байтовый Auth Key. Без него приватные команды здоровья
  не открываются.
- Схема auth:
  - телефон генерирует 16-байтовый nonce;
  - часы возвращают свой nonce + HMAC;
  - приложение выводит 64 байта через HMAC-SHA256 с меткой `miwear-auth`;
  - эти байты делятся на decrypt key, encrypt key, decrypt nonce, encrypt nonce;
  - приложение проверяет HMAC часов;
  - приложение отправляет зашифрованный auth-ответ.
- В v2 полезная нагрузка шифруется через AES-CTR. В Gadgetbridge ключ также
  используется как IV.

Поток чтения здоровья в Gadgetbridge:

1. Отправить запрос файлов активности за сегодня.
2. Часы возвращают список 7-байтовых ID файлов.
3. После списка за сегодня сразу запросить файлы из истории.
4. Сложить все ID в очередь.
5. Запрашивать по одному файлу.
6. Собрать chunks:
   - первые 2 байта: всего chunks;
   - следующие 2 байта: номер chunk;
   - данные начинаются с байта 4.
7. На последнем chunk:
   - проверить CRC32 по данным файла без последних 4 байт;
   - прочитать первые 7 байт как file ID;
   - при необходимости отправить ACK;
   - выбрать parser по type/subtype/detail/version;
   - перейти к следующему файлу.

Подтверждено по коду Gadgetbridge:

- запрос файла: команда `type=8`, `subtype=3`, protobuf поле
  `Health.activityRequestFileIds = 2`;
- подтверждение файла: команда `type=8`, `subtype=5`, protobuf поле
  `Health.activitySyncAckFileIds = 3`;
- ACK отправляется после того, как файл получен, CRC сходится и файл передан в
  parser.

Подтверждено по логам Mi Fitness:

- официальный клиент ведет состояние файла, а не просто читает поток;
- после `processBinaryData: isSuccess = true` идет `onSyncSuccess ... status(2)`;
- потом приложение вызывает `confirmFitnessId: true`;
- после подтверждения идет `onSyncSuccess ... status(4)`;
- счетчик `unSynced size` уменьшается до `0`.

Это значит, что для PERFORM Sync правильная модель такая: файл должен пройти
`read -> CRC -> parse -> save -> ACK`. ACK до сохранения на сервер делать нельзя.

## Проверка Gadgetbridge на Redmi Watch 5, 24.05.2026

Проверка сделана на подключенном Android-телефоне с Redmi Watch 5:

- device: `Redmi Watch 5 0FFE`;
- address: `D4:A3:65:CE:0F:FE`;
- Gadgetbridge: full debug build `0.91.1`;
- путь сборки:
  `_external/Gadgetbridge/app/build/outputs/apk/mainline/debug/app-mainline-debug.apk`.

Результат подключения:

- часы подключились через Gadgetbridge без Companion Device Manager, после
  выбора обычного ручного подключения;
- статус в Gadgetbridge: `Соединено`;
- батарея часов: `46%`;
- скриншот подключения:
  `/tmp/perform-gb/gadgetbridge-connected.png`.

Результат синхронизации:

- после нажатия sync Gadgetbridge прочитал реальные данные часов;
- на главной карточке появились `10273` шагов и `6.9 km`;
- скриншот после sync:
  `/tmp/perform-gb/gadgetbridge-after-sync-tap.png`;
- список активности:
  `/tmp/perform-gb/gadgetbridge-activity-list.png`.

В базе Gadgetbridge после sync:

- `XIAOMI_ACTIVITY_SAMPLE`: `4849` точек, диапазон с 19.05 по 24.05;
- `XIAOMI_DAILY_SUMMARY_SAMPLE`: `5` дневных итогов;
- `XIAOMI_SLEEP_STAGE_SAMPLE`: `109` фаз сна;
- `XIAOMI_SLEEP_TIME_SAMPLE`: `3` сна;
- `XIAOMI_MANUAL_SAMPLE`: `25` ручных замеров;
- `BASE_ACTIVITY_SUMMARY`: `1` тренировка.

По дневным точкам Gadgetbridge получил:

- HR: средний `69.5`, min `47`, max `122`;
- SpO2: средний `96.1`, min `90`, max `99`;
- дни:
  - 19.05: `3831` шаг, `2.3 km`, max HR `90`;
  - 20.05: `4832` шага, `2.9 km`, max HR `102`;
  - 21.05: `2556` шагов, `1.54 km`, max HR `108`;
  - 22.05: `8203` шага, `4.93 km`, max HR `122`;
  - 23.05: `11684` шага, `7.18 km`, max HR `111`;
  - 24.05: `10273` шага, `6.9 km`, max HR `106`.

По сну Gadgetbridge получил:

- 21.05 `01:11 -> 07:08`: `357` мин, deep `140`, light `113`, REM `104`;
- 22.05 `00:39 -> 06:27`: `348` мин, deep `122`, light `125`, REM `101`;
- 22.05 `23:25 -> 23.05 07:32`: `483` мин, deep `179`, light `183`,
  REM `121`, awake `4`.

По тренировкам Gadgetbridge получил одну тренировку:

- start: `2026-05-23 21:12:39`;
- end: `2026-05-23 21:35:31`;
- тип в базе: `ACTIVITY_KIND = 32`;
- raw files: `SPORTS_OUTDOOR_WALKING_V2` details, summary и GPS track.
- Проверка raw summary `20260523T211239_01_16_01_v6.bin` показала, что
  walking v2 summary содержит нужные основные метрики:
  - duration `22` мин;
  - distance `928` м;
  - steps `1291`;
  - calories `135` active / `176` total;
  - HR min/avg/max `58/86/112`.

Сырые файлы Gadgetbridge сохранил в:

`/sdcard/Android/data/nodomain.freeyourgadget.gadgetbridge/files/D4:A3:65:CE:0F:FE/rawFetchOperations/`

Всего найден `71` файл. Типы файлов:

- `ACTIVITY/ACTIVITY_DAILY/DETAILS/*_v3.bin`;
- `ACTIVITY/ACTIVITY_DAILY/SUMMARY/*_v5.bin`;
- `ACTIVITY/ACTIVITY_MANUAL_SAMPLES/DETAILS/*_v2.bin`;
- `ACTIVITY/ACTIVITY_SLEEP/SUMMARY/*_v4.bin`;
- `SPORTS/SPORTS_OUTDOOR_WALKING_V2/DETAILS/*_v5.bin`;
- `SPORTS/SPORTS_OUTDOOR_WALKING_V2/SUMMARY/*_v6.bin`;
- `SPORTS/SPORTS_OUTDOOR_WALKING_V2/GPS_TRACK/*_v2.bin`.

Главный вывод проверки:

- Redmi Watch 5 отдает не один общий поток, а список файлов;
- рабочий поток Gadgetbridge полностью совпадает с нашей целевой схемой:
  `today list -> past list -> queue -> file chunks -> CRC -> parser -> save -> ACK`;
- сон, SpO2, стресс, пульс, шаги, дистанция, калории и тренировка реально
  доступны с часов;
- искусственная дискретизация "каждые 5 минут" не нужна: надо сохранять точки
  как отдают часы, чаще всего поминутно;
- первая история, которую реально отдал этот экземпляр часов, сейчас около 5-6
  дней, а не весь месяц. Причины надо проверять отдельно: старые файлы могли
  быть уже подтверждены Mi Fitness/Gadgetbridge или часы могут держать только
  ограниченную очередь неподтвержденных файлов.

Формат 7-байтового file ID:

- 4 байта little-endian Unix timestamp.
- 1 байт timezone в блоках по 15 минут.
- 1 байт версия файла.
- 1 байт flags:
  - bit 7: type, `0` активность, `1` спорт/тренировка;
  - bits 2..6: subtype;
  - bits 0..1: detail type.

Полезные типы файлов:

- `type=0, subtype=0, detail=0` - поминутная дневная активность.
- `type=0, subtype=0, detail=1` - итог дня.
- `type=0, subtype=3` - фазы сна на части прошивок.
- `type=0, subtype=6` - ручные замеры здоровья.
- `type=0, subtype=8` - сон.
- `type=1, detail=1` - итог тренировки.
- `type=1, detail=2` - GPS/трек тренировки.

## Дополнительная проверка 25.05.2026

Сравнил нашу реализацию с исходниками Gadgetbridge и реальными raw-файлами:

- `XiaomiActivityFileFetcher` в Gadgetbridge читает файлы строго очередью:
  список ID -> запрос одного файла -> сбор chunks -> CRC32 -> dump raw ->
  parser -> следующий файл.
- В PERFORM этот порядок уже реализован в `requestClassicActivityFilesSequentially`:
  список файлов дедуплицируется, сортируется, каждый файл читается отдельно,
  сборка chunks проверяется через CRC, затем файл парсится и только после этого
  может подтверждаться.
- `WorkoutSummaryParser` в Gadgetbridge парсит `SPORTS_FREESTYLE` summary для
  версий `5`, `7`, `8`, `9`, `10`.
- `XiaomiActivityParser.createForSports` в Gadgetbridge не парсит sports
  `DETAILS`; для sports он выбирает только `SUMMARY` и `GPS_TRACK`. Поэтому
  детали Freestyle с точками пульса остаются нашей подтвержденной эвристикой,
  которую надо валидировать по совпадению с summary.

Проверенные raw-файлы:

- Gadgetbridge walking v2 summary `20260523T211239_01_16_01_v6.bin`:
  CRC сходится, summary дает `22` мин, `928` м, `1291` шаг, `135` active kcal,
  HR `58/86/112`.
- Gadgetbridge walking v2 details `20260523T211239_01_16_00_v5.bin`:
  CRC сходится, наша эвристика дает `1360` секундных точек HR, диапазон
  `58..112`, средний `85`, что совпадает с summary.
- Gadgetbridge walking GPS `20260523T211239_01_16_02_v2.bin`:
  CRC сходится, `762` GPS-точки.
- PERFORM Freestyle summary `F83C146A0C0AA1_type1_sub8_detail1_v10.bin`:
  CRC сходится, по схеме Gadgetbridge дает старт `2026-05-25T12:13:44Z`,
  конец `2026-05-25T12:16:24Z`, active `159` сек, `12` kcal,
  HR `64/68/79`.
- PERFORM Freestyle details `F83C146A0C03A0_type1_sub8_detail0_v3.bin`:
  CRC сходится, наша эвристика дает `149` секундных точек HR, диапазон
  `64..79`, средний `68`, что совпадает с Freestyle summary.

Правка по результату:

- В `DirectWatchPlugin.kt` добавлен точный Freestyle summary parser по схеме
  Gadgetbridge для версий `5`, `7`, `8`, `9`, `10`.
- Теперь для Freestyle duration/calories/min-avg-max HR берутся из summary, а
  не из эвристического сканирования payload.

## Разбор 26.05.2026: пропавшие поля тренировок

Проверка на телефоне и боевой базе показала:

- для 25.05 часы сейчас повторно отдают только файл сна `44A6146A0C0421`;
- файлы тренировок 25.05 уже подтверждены и ушли из очереди часов, поэтому
  повторно прочитать их с устройства нельзя;
- в боевой базе walking-тренировки с summary-файлом содержат длительность,
  дистанцию, калории, пульс и шаги;
- длинная freestyle-тренировка `2026-05-25 13:52` сохранена только по
  `DETAILS`-файлу `0554146A0C03A0`, без paired `SUMMARY`, поэтому у нее нет
  дистанции и шагов. Для freestyle это ожидаемо: Gadgetbridge summary также не
  содержит distance/steps, только duration/calories/HR/zones;
- если новый workout придет без summary/GPS, теперь raw payload сохраняет
  `activityFileProbeRequests`, чтобы было видно: файл отсутствовал в inventory,
  не дочитался, не прошел CRC или не распарсился.

Правки:

- лимит очереди файлов активности поднят с `128` до `512`;
- добавлены точные summary-parser'ы по схемам Gadgetbridge для основных
  subtype: outdoor walk/run v1, treadmill, outdoor cycling, indoor cycling,
  pool swimming, elliptical, rowing, jump rope, HIIT, outdoor cycling v2;
- это закрывает главную дыру, где неизвестный subtype уходил в эвристику и мог
  терять distance/steps/calories.

Ограничение проверки:

- Gadgetbridge Intent API broadcast в текущей сессии не запустил новый sync
  видимым образом: raw-файлов осталось `71`, логов `Triggering activity sync`
  не появилось. Для следующей ручной проверки лучше запускать sync из UI
  Gadgetbridge или через активный service state.

## Что уже есть в PERFORM

Основные файлы:

- `apps/mobile/android/app/src/main/java/com/perform/training/DirectWatchPlugin.kt`
- `apps/mobile/android/app/src/main/java/com/perform/training/DirectWatchForegroundService.kt`
- `apps/mobile/src/integrations/direct-watch.ts`
- `apps/mobile/src/screens/app.ts`
- `apps/mobile/src/storage/local-store.ts`
- `apps/mobile/src/sync/sync-queue.ts`

Уже реализовано:

- Android Capacitor plugin умеет искать часы, смотреть сервисы, делать
  системное сопряжение/отвязку, открывать BLE session и выполнять Classic/SPP
  диагностику.
- Есть определение SPP v1/v2 через version request и `shouldUseClassicSppV2`.
- Есть auth:
  - SPP socket connect;
  - session config для v2;
  - phone nonce;
  - auth step 1;
  - HMAC-derived keys;
  - auth step 2;
  - отправка зашифрованных команд.
- Есть служебная синхронизация:
  - установка времени и timezone;
  - отправка геопозиции телефона;
  - отправка локации погоды, порядка локаций и настроек;
  - отправка текущей погоды, прогноза по дням и по часам;
  - foreground bridge до 2 часов;
  - ответы на запросы погоды/локации от часов, пока bridge живой.
- Есть чтение активности:
  - запрос списка файлов за сегодня и из истории;
  - извлечение 7-байтовых file IDs;
  - фильтр файлов под выбранную дату;
  - запрос файлов активности.
- Есть сборка chunks:
  - читаем total/number;
  - собираем многочастный файл;
  - проверяем CRC32;
  - парсим file ID.
- Есть безопасная ACK-политика:
  - native plugin умеет отправлять ACK по списку 7-байтовых file ID;
  - TypeScript собирает ACK только по файлам со статусом `complete` и валидным
    CRC;
  - приложение отправляет ACK часам только после успешной отправки данных в API;
  - если сервер недоступен и данные ушли в локальную очередь, ACK не отправляем.
- Есть парсеры:
  - поминутная дневная активность;
  - итог дня;
  - сон;
  - старые фазы сна;
  - пульс, SpO2, стресс из дневных деталей.
  - ночные точки пульса и SpO2 из файлов сна `type=0, subtype=8`.
- Mobile TypeScript превращает native packets в:
  - daily summary;
  - health samples;
  - sleep summary;
  - базовые workout payloads;
  - payloads для `/device-health/daily-summaries` и `/device-health/workouts`.
- Первая синхронизация истории проходит до 30 дней и показывает прогресс.
- Автосинхронизация запускается после старта приложения и далее примерно раз в
  30 минут, если есть часы и Auth Key.

Важные текущие константы:

- `DIRECT_WATCH_SERVICE_KEEP_ALIVE_MS = 2 hours`
- `DIRECT_WATCH_AUTO_SYNC_INTERVAL_MS = 30 minutes`
- `DIRECT_WATCH_HISTORY_SYNC_DAYS = 30`
- `CLASSIC_ACTIVITY_FILE_PROBE_LIMIT = 512`
- `DIRECT_WATCH_TIME_OFFSET_MINUTES = 0` в `direct-watch.ts`; ручной `-90`
  больше не используется.

## Пробелы и риски

Это места, из-за которых сейчас могут не приходить пульс, сон, тренировки или
история.

1. Очередь файлов активности уже есть, но ее надо добить до production-режима.
   - PERFORM теперь запрашивает файлы по одному, собирает chunks и проверяет CRC.
   - Для выбранной даты читаются только файлы этой даты, без подмешивания
     ближайших старых дней.
   - Осталось: ACK-политика, повтор частичных файлов, больше parser coverage.

2. ACK-политика добавлена, но ее надо проверить на реальном телефоне.
   - Ожидаемое поведение: после успешной синхронизации один и тот же файл не
     должен возвращаться снова как непрочитанный.
   - Важно: если API недоступен, ACK не отправляется, и это правильно.
   - Осталось проверить по логам DirectWatch после установки на Android.

3. Лимит файлов может быть слишком мал.
   - Сейчас в коде `CLASSIC_ACTIVITY_FILE_PROBE_LIMIT = 512`.
   - В проверке Gadgetbridge на Redmi Watch 5 за одну синхронизацию было
     найдено `71` raw files.
   - Риск стал ниже, но остается архитектурно: при первой синхронизации истории
     фиксированного числа может не хватить, особенно если есть сон, ручные
     замеры, несколько тренировок, GPS и дополнительные файлы прошивки.
   - Правильнее сделать лимит динамическим или читать очередь пачками до
     исчерпания нужных дат, а не резать общий список фиксированным числом.

4. Тренировки больше не парсятся только поверхностно.
   - 26.05 PERFORM сверили с `WorkoutSummaryParser` Gadgetbridge: основные
     summary subtype/version закрыты для freestyle, walking/running,
     treadmill, cycling, indoor cycling, HIIT, elliptical, rowing, jump rope и
     pool swimming.
   - Summary уже дает duration, calories, distance/steps где они есть,
     HR min/avg/max, зоны ЧСС, training effect/load/recovery и профиль спорта.
   - GPS/track v1/v2 разобран отдельно.
   - Остающийся риск: sports DETAILS с точками пульса внутри тренировки -
     собственная экспериментальная часть PERFORM, потому что Gadgetbridge не
     дает готового parser для этих файлов.

5. Ручные замеры не выделены как отдельный источник.
   - В Gadgetbridge есть `ManualSamplesParser`.
   - В PERFORM хорошо читаются дневные детали, но ручные HR/SpO2/stress/temp
     файлы требуют отдельного parser.

6. Сон поддержан частично, но уже не только как итог.
   - Parser поддерживает известные варианты sleep details/stages.
   - Для реальных файлов Redmi Watch 5 `*_00_08_01_v4.bin` PERFORM теперь
     достает duration/deep/light/REM/awake и ночные HR/SpO2 sample series.
   - У Xiaomi форматы зависят от прошивки и версии файла.
   - Если сон есть за месяц на часах, но не приходит в PERFORM, причины могут
     быть такие: файл не запрошен, файл отфильтрован лимитом/датой, версия файла
     сна пока не поддержана.

7. Хранилище и графики надо разделить яснее.
   - Local snapshot специально чистит workout samples, чтобы не переполнить
     localStorage.
   - Daily health samples ограничены 6000 точками.
   - Графики тренировок должны открываться из сохраненных/кэшированных данных,
     а не пересчитывать все при открытии карточки.

8. Синхронизацию времени надо наблюдать на длинном тесте.
   - Ручной `-90` минут удален.
   - Финально надо подтвердить поведение timezone/DST на телефоне и часах после
     нескольких часов работы bridge.

## Правильное направление реализации

Идем так:

1. Оставляем собственную реализацию PERFORM.
2. Gadgetbridge используем как карту поведения, без копирования кода.
3. Переводим PERFORM Sync из probe-style в нормальный sync engine:
   - авторизоваться один раз;
   - запросить список today;
   - запросить список past;
   - собрать сортированную очередь файлов;
   - запросить один файл;
   - собрать chunks;
   - проверить CRC;
   - распарсить;
   - сохранить в API;
   - ACK только после успешного сохранения;
   - запросить следующий файл;
   - сохранить debug metadata.
4. Добавить parser coverage:
   - manual samples;
   - workout summary;
   - workout GPS/track;
   - версии сна, которые увидим в наших логах.
5. UI должен читать уже сохраненные данные быстро:
   - карточка тренировки открывается сразу;
   - графики грузятся лениво;
   - chart-ready series кэшируются;
   - все графики не рендерятся до клика пользователя.

## Сверка PERFORM против Gadgetbridge, 24.05.2026

По коду PERFORM было найдено важное расхождение с эталонным поведением:

- `isClassicFetchableActivityFile()` выбирал daily details, daily summary,
  sleep files, manual samples, workout summary и workout GPS.
- Но Gadgetbridge на этих же часах реально скачал еще:
  - workout details `type=1, subtype=22, detail=0, version=5`;

Что это значит:

- если PERFORM не запрашивает workout details, тренировка может иметь только
  summary/GPS без полноценной детализации пульса;
- текущий `classicActivityFetchOrder()` уже знает про workout details, но
  `isClassicFetchableActivityFile()` их не пропускает. Это внутренняя
  несогласованность, ее надо убрать.

Важная осторожность:

- нельзя просто расширить список fetchable файлов и сразу ACK-ать все complete
  files;
- сейчас ACK собирается из `activityFileProbeRequests` по статусу
  `complete + crcValid`;
- если мы начнем читать manual/GPS/details без parser и сохранения, есть риск
  подтвердить часам файл, который PERFORM фактически не сохранил.

Правильная правка:

1. Parser + payload mapping для manual samples добавлен 24.05.
2. Parser + payload mapping для workout GPS добавлен до 25.05.
3. Parser + payload mapping для workout details `SPORTS_OUTDOOR_WALKING_V2`
   `type=1, subtype=22, detail=0, version=5` добавлен 25.05:
   - запись идет блоками по 13 байт;
   - старт блока для текущего формата: offset `124`;
   - основное поле ЧСС: byte `+11`;
   - fallback ЧСС для хвоста файла: byte `+2`;
   - проверено на файле
     `/tmp/perform-gb-raw/sports/SPORTS/SPORTS_OUTDOOR_WALKING_V2/DETAILS/20260523T211239_01_16_00_v5.bin`;
   - получено 1360 точек ЧСС, min `58`, avg `85`, max `112`, что совпадает
     с summary-тренировкой по диапазону.
4. Изменить ACK whitelist: подтверждать только те file IDs, которые:
   - прочитаны полностью;
   - прошли CRC;
   - распарсены;
   - успешно сохранены в API или в надежное локальное хранилище.
5. `isClassicFetchableActivityFile()` расширен под workout details 25.05.

Отдельное наблюдение по Gadgetbridge: текущий Xiaomi activity parser выбирает
parser для workout summary и workout GPS, но не создает parser для sports
DETAILS. Поэтому эту часть мы не копируем, а ведем как собственный PERFORM
parser по реальным raw-файлам.

## Чеклист диагностики

По каждому багу часов сначала фиксируем это:

- Модель Android-телефона и версия Android.
- Модель часов, прошивка, Bluetooth address.
- Auth Key status: формат, auth stage, финальный authenticated state.
- Какой путь используется: SPP v1, SPP v2, BLE v1, BLE v2.
- Сервисы и характеристики из inspection.
- Mi Fitness подключен, удален или держит канал.
- `activityFileCount` из today и past списков.
- Все file IDs: timestamp, timezone, type, subtype, detail, version.
- Какие IDs выбраны для нужной даты.
- Какие IDs реально запрошены.
- По каждому файлу:
  - количество chunks;
  - полученные chunks;
  - payload bytes;
  - CRC result;
  - выбранный parser;
  - распарсенные поля;
  - был ли ACK.
- Что ушло на сервер:
  - есть ли daily summary;
  - сколько health samples по каждому metric;
  - сколько workouts;
  - сколько workout samples.

## Следующие задачи

## Текущая реализация после правки 24.05.2026

- Batch-запрос файлов заменен на последовательную очередь:
  список IDs сортируется, каждый файл запрашивается отдельно, чтение идет до
  полного chunk set и CRC, затем очередь переходит к следующему файлу.
- Для конкретного дня больше нет fallback на ближайшие старые даты: если часы
  не отдали файлы выбранного дня, PERFORM обновляет время/погоду и не трогает
  уже сохраненные показатели.
- В ответ `probeClassicSession` добавлена диагностика очереди:
  `activityFileProbeCompletedCount`, `activityFileProbeFailedCount`,
  `activityFileProbeRequests`.
- Добавлен первый разбор workout summary:
  start/end/duration, calories, distance, steps, HR min/avg/max, HR zones,
  workout type.
- Для `type=1, subtype=22` (walking v2) summary больше не читается "по
  похожим числам": используется известная раскладка Gadgetbridge для версий
  1/4/5/6/9. Это важно, потому что прежний generic scan мог принять шаги за
  calories.
- Для сна добавлен лог unsupported версий файлов, чтобы не гадать, почему
  конкретный сон не распарсился.
- В служебной синхронизации убран временный offset `-90 минут`; время теперь
  отправляется по системной timezone/DST телефона.
- 24.05 исправлена кодировка timezone: поля `TimeZone.zoneOffset` и
  `TimeZone.dstOffset` в Xiaomi proto имеют тип `sint32`, поэтому их надо
  отправлять zigzag-кодировкой. Обычный `int32` давал неправильное смещение
  времени на часах.
- 24.05 исправлена привязка пульса/SpO2 к дню: часы могут хранить ночные
  минутные точки в файле, который стартовал вечером предыдущего дня. PERFORM
  теперь относит такие точки к выбранной дате по времени каждой точки, а не
  только по дате начала файла.
- Сообщение в приложении разделено: отсутствие файлов за день больше не
  показывается как ошибка авторизации.
- Открытие карточки тренировки ускорено: при раскрытии карточки не строятся
  графики и не сканируются большие массивы samples, пока пользователь явно не
  откроет графики.
- Подробные графики часов переведены на `uPlot`: рендер идет через Canvas,
  сырые точки остаются в данных, а для экрана используется min/max decimation
  до ключевых точек, чтобы пики не терялись и WebView не подвисал.
- 24.05 добавлен ACK после успешного сохранения в API: PERFORM подтверждает
  часам только файлы из `activityFileProbeRequests`, которые были прочитаны
  полностью и прошли CRC. ID из распарсенного payload не используются для ACK,
  чтобы не подтвердить случайно найденные байты как файл.
- 24.05 добавлена дополнительная защита ACK: native parser ставит
  `activityFileParsed`, а TypeScript добавляет файл в ACK только если
  `status=complete`, `crcValid=true` и `parsed=true`. Это нужно перед
  расширением fetchable типов, чтобы не подтвердить часам файл, который PERFORM
  еще не умеет сохранять.
- 24.05 добавлена первая поддержка manual samples:
  `type=0, subtype=6, detail=0, version=2`. PERFORM теперь выбирает эти файлы,
  парсит ручные HR/SpO2/stress замеры и кладет их в общий поток samples.
  Temperature пока пропускается, потому что в текущей модели API есть только
  `heart_rate`, `oxygen_saturation` и `stress`.
- 24.05 добавлен parser GPS-трека тренировки:
  `type=1, detail=2`, версии `1/2`. Для walking v2 на реальном файле найдено
  `762` GPS-точки; PERFORM теперь может сохранять их как workout samples со
  скоростью, накопленной дистанцией и координатами в `rawPayload`.
- 24.05 workout samples теперь объединяют GPS-трек и дневные HR-точки внутри
  окна тренировки. GPS больше не вытесняет пульс из графика тренировки.
- 24.05 `CLASSIC_ACTIVITY_FILE_PROBE_LIMIT` поднят с `64` до `128`, потому что
  эталонный Gadgetbridge за одну проверку сохранил `71` raw file.
- 25.05 исправлен UX-риск настройки: пустое поле Auth Key больше не удаляет
  сохраненный ключ. Ключ можно заменить только если введен новый валидный
  32-hex ключ.
- 25.05 отключено Capacitor bridge logging в mobile config, чтобы debug logcat
  не печатал `authKeyHex` в `methodData`.
- 25.05 повторная синхронизация больше не должна накапливать дубли тренировок
  с одинаковым athlete/provider/date/type/start/duration/distance; входящие
  записи заменяют старые, а список недавних тренировок перед отображением
  дедуплицируется.
- 25.05 локальный snapshot на Android проверен после установки: список
  тренировок уменьшился с `6` до `3`, direct-watch дубли 24.05 схлопнулись до
  одной записи на тренировку.
- 25.05 добавлена серверная защита для `direct-watch`: если новая стабильная
  схема `sourceWorkoutId` совпадает со старой тренировкой по дню, типу, старту,
  окончанию, длительности и дистанции, API переиспользует существующую запись и
  сохраняет привязки к плану, а старые непривязанные дубли удаляет.
- 25.05 ускорена вкладка "Часы": контекст дневных samples для списка тренировок
  кэшируется на дату, проверка наличия графика больше не строит полный набор
  series, а форматтер времени графиков переиспользуется.
- 25.05 на подключенном Android установлена свежая сборка. Ручной запуск
  "Обновить" в WebView прошел без ошибки Auth Key; weather bridge отправил
  локацию/текущую/дневную/почасовую погоду. За 25.05 часы отдали только stress,
  тренировок за день не отдали.
- 25.05 подтверждена старая ошибка parser shift на walking v2 summary: в
  legacy-записях дистанция могла быть равна `activeSeconds`, а настоящая
  дистанция попадала в калории/шаги. Новый native parser читает правильный
  offset; UI теперь не показывает фальшивые калории/шаги для таких legacy
  записей, а сервер умеет склеивать старую shifted-запись с новой правильной.
- 25.05 после установки на Android проверен экран "Часы": тренировка 23.05
  вместо ошибочных `1.4 км / 928 шагов` показывает `928 м` и не выводит ложные
  шаги/калории.
- 25.05 production API обновлен точечно: `device-health.service.ts`
  задеплоен на `~/v3Final`, контейнер `training-platform-api` пересобран,
  `/api/v1/health` отвечает `200`. Новый APK также положен в
  `/downloads/perform-mobile-android.apk` на боевом сайте; внешний HEAD-запрос
  вернул `200` и `Content-Type: application/vnd.android.package-archive`.
- Проверка на реальном Redmi Watch 5: после ACK повторная синхронизация
  вернула `inventory total=0 selected=0`, значит очередь на часах очищается и
  повторно не присылает уже обработанные файлы.
- 25.05 parser сна расширен: ночные HR/SpO2 series из sleep details теперь
  попадают в `activitySamples`, а дневная сборка считает пульс/кислород не
  только по дневным details, но и по sleep/manual samples выбранной даты.
  Проверка raw-файлов Gadgetbridge показала, что сон 23.05 содержит `540`
  минутных HR-точек и `540` SpO2-точек; раньше PERFORM их пропускал.
- 25.05 ускорена загрузка тренировок: API теперь по умолчанию отдает список
  тренировок без тяжелых `samples`, а точки графика возвращает только для
  выбранной даты через `includeSamples=true`. Production API пересобран и
  проверен: общий список вернул `0` загруженных точек, выбранный день 11.05
  вернул `2315/2315` точек.
- 25.05 мобильное приложение догружает samples тренировки лениво при раскрытии
  карточки. На подключенном Android проверено: тренировка 11.05 сначала была в
  списке без точек, после открытия подтянула `2315` точек и открыла экран
  самой тренировки с графиком пульса/зонами, а не дневной пульс за текущую дату.
- 25.05 свежий APK с этой логикой установлен на подключенный Android и
  обновлен на боевом сайте. SHA-256 локального APK, файла в `apps/web/public`
  на сервере и файла внутри web-контейнера совпал:
  `f97c3e16349e3f8ecffd69f1e628fc5c4fe917e093a3caa9dda885238c802bd2`.
- 25.05 на свежей тренировке `walking v2` часы отдали связку файлов:
  details `3302146A0C05D8` (`1148` HR-точек), summary `3302146A0C06D9`
  (`1483 м`, `1999` шагов, HR `93/108/113`) и GPS `3302146A0C02DA`
  (`570` точек). После ACK watch inventory уже не отдавал эти workout files.
- 25.05 найден важный риск: повторная синхронизация после ACK может прислать
  только summary/GPS без details, и старый API при полном `DELETE/INSERT`
  стирал сохраненные HR-точки. Исправлено на production API: для provider
  `direct-watch` сервер перед заменой samples читает уже сохраненные точки,
  склеивает их по `sample_time` с входящими точками и сохраняет старые HR-поля,
  если новая синхронизация пришла частичной.
- 25.05 защита от downgrade проверена на боевой базе: старая тренировка 23.05
  после намеренно частичного GPS-only upsert сохранила `1370` samples и `1360`
  HR-точек. Для уже перезаписанной тренировки 25.05 детальная HR-кривая не
  восстановима с часов, потому что details-файл уже ACK-нут и не доступен.
- 25.05 мобильный экран тренировки больше не обещает "Открыть пульс", когда
  detailed HR-series отсутствует: детальный экран на Android открылся как
  "Темп" и показал canvas без ошибок.
- 25.05 APK после этой правки установлен на Android и обновлен на боевом сайте.
  SHA-256 локальной сборки и файла внутри web-контейнера совпал:
  `46537c2399d36912f890899127ac68ec99c0790bce45bb6e513f13bcc1ebdc23`.
- 25.05 добавлена страховка перед ACK: Android native теперь возвращает полный
  `activityFileRawHex` собранного файла активности, мобильный JS сохраняет
  последние raw-пакеты в `perform.mobile.directWatchRawCache` до подтверждения
  часов. ACK отправляется только после успешной отправки `device-health` и
  `device-workouts`; если payload ушел в offline queue, cache получает статус
  `queued`, а после успешного flush очереди приложение повторно проверяет cache
  и только затем подтверждает файлы часам.
- 25.05 проверка на подключенном Android показала, что raw-cache создается:
  сохранены 7 файлов за 25.05 с полным `rawHex` по каждому доступному файлу.
  Телефон был на системной шторке/блокировке, поэтому клик по UI через WebView
  был нестабилен, но APK установлен и приложение стартует.
- 25.05 свежий APK с raw-cache/ACK-страховкой установлен на Android и обновлен
  на боевом сайте. SHA-256 локальной сборки и файла внутри web-контейнера:
  `21673daea49e52f75b4eb3696a19489b0611124c39bc1a951b75a07cb1fee8a9`.
- 25.05 сравнение с Gadgetbridge выявило отличие: эталонный клиент после
  `CMD_ACTIVITY_FETCH_TODAY` всегда запрашивает `CMD_ACTIVITY_FETCH_PAST`.
  PERFORM для текущего дня раньше читал только today/today-alt, поэтому спорт-
  файлы могли не попадать в inventory. Исправлено: дневная синхронизация теперь
  тоже читает расширенный список IDs, а затем выбирает только нужную дату.
- 25.05 финальная проверка на Android после правки: inventory за 25.05 отдал
  9 файлов (`0/0/0`, `0/0/1`, `0/6/0`, `0/8/1`), но ни одного sports-файла
  `type=1`. Значит новые тренировки в текущем ответе часов отсутствуют; две
  тренировки в UI берутся из уже сохраненной базы. APK SHA-256:
  `5cef1ca673e73dc14b1cae654f6c0d670da54ecca4988a5cb35f34cef286a4c6`.
- 25.05 дополнительная сверка с Gadgetbridge нашла реальный пробел сна:
  `SleepDetailsParser` поддерживает версии `1..5`, а PERFORM отбрасывал
  `type=0/subtype=8` с `version=5`. Исправлено: parser сна теперь допускает v5,
  читает двухбайтовый header и дополнительные поля перед HR/SpO2 sections по
  схеме Gadgetbridge.
- 25.05 проверка новой тренировки на подключенном Android: часы отдали sports-
  файлы `0554146A0C0AA1` (`type=1/subtype=8/detail=1/v10`) и
  `0554146A0C03A0` (`type=1/subtype=8/detail=0/v3`), оба с `crc=true` и
  `parsed=true`. Итог тренировки: freestyle, 92 мин, 360 ккал, ЧСС 56-126.
  Health Connect за 25.05 не отдал тренировок; база Gadgetbridge на телефоне
  содержит последнюю тренировку 23.05, поэтому новая запись видна только через
  DirectWatch. Найдена причина, почему UI не показал тренировку: API принимал
  максимум 2500 samples, а эта тренировка содержит 5520 секундных HR-точек.
  Исправлено локально: лимит поднят до 30000, списки тренировок не тянут samples
  по умолчанию, DirectWatch дедуплицирует одинаковые файлы по `idHex`.
- 25.05 повторная проверка после установки на Android: первый проход сохранил
  только `1085` HR-точек, потому что большой файл деталей пришел как
  `partial-timeout` (`chunk=1/6`). Исправлено: native bridge теперь отслеживает
  промежуточные chunks по текущему файлу, для workout-details дает больший
  read/no-progress timeout, а TS-слой не отправляет файлы без `crc=true` как
  полноценные данные. Контрольный проход: `0554146A0C03A0` прочитан полностью
  (`chunk=6/6`, `crc=true`, `bytes=22127`), API принял тренировку 92 мин с
  `5520` samples.
- 25.05 найден второй лимит: Fastify отклонял полный пакет тренировки с
  `413 Request body is too large`. API `bodyLimit` поднят до 10 MB
  (`API_BODY_LIMIT_BYTES` можно переопределить через env). После деплоя боевой
  API возвращает тренировку 25.05 с `5520` samples.

Приоритет 1 - надежность импорта данных:

- Считать ACK-политику базово подтвержденной: read -> CRC -> parse -> API save
  -> ACK.
- Дальше проверять новые типы файлов по фактическим `activityFileProbeRequests`,
  без fallback на "похожие" ID из payload.
- `CLASSIC_ACTIVITY_FILE_PROBE_LIMIT` поднят до `512`. По проверке Gadgetbridge
  было видно, что `64` находится на границе: эталонный клиент сохранил `71` raw
  file. Следующий шаг - уйти от фиксированного лимита к date-scoped очереди без
  жесткого потолка.

Приоритет 2 - тренировки:

- Проверять следующий свежий workout по фактическим
  `activityFileProbeRequests`: subtype/version, CRC, summary, details, GPS и
  сохранение в API.
- Summary-parser coverage по основным subtype/version уже сверено с
  Gadgetbridge 26.05; новые parser'ы добавлять только если в логах появится
  неизвестный subtype/version.
- GPS/track parser уже добавлен для версий `1/2`; следующий шаг - связать GPS с
  HR-точками на следующей свежей тренировке и проверить, что экран показывает
  duration/calories/distance/steps/zones без дублей.
- Хранить samples тренировки так, чтобы экран тренировки открывался мгновенно.
  Текущая реализация: общий список легкий, samples догружаются по дате при
  открытии нужной тренировки.
- Для уже ACK-нутых старых тренировок 23.05/24.05 нельзя заново получить raw
  файлы с часов без новой записи на устройстве; корректность новых parsers
  нужно подтверждать на следующей свежей тренировке.

Проверка 26.05 на реальном Redmi Watch 5:

- В 07:56 EEST приложение успело скачать свежую freestyle-тренировку:
  summary `6925156A0C0AA1` (`type=1`, `subtype=8`, `detailType=1`,
  `version=10`) и details `6925156A0C03A0` (`type=1`, `subtype=8`,
  `detailType=0`, `version=3`).
- Оба файла пришли полностью: `crc=true`, `parsed=true`; details дал `246`
  точек пульса. API сохранил тренировку 26.05:
  duration `4` мин, calories `15`, HR `56/66/78`, samples `246`.
- Повторный probe после ACK уже не показывает sports-файлы в inventory. Это
  нормальное поведение: часы отдают только еще не подтвержденные файлы.
- Запись была создана старой установленной сборкой до обновления workout
  profiles, поэтому в API сначала стояли `missingMetrics=["distance","steps"]`.
  Для `freestyle` это неверно: профиль `gym`, дистанция и шаги не обязательны.
  Метаданные этой записи переотправлены без повторного ACK и без удаления
  samples: `dataCompleteness=complete`, `missingMetrics=[]`,
  `workoutProfile.id=gym`.

Повторная проверка 26.05 на новой свежей тренировке:

- Авто-синхронизация PERFORM Sync сама забрала тренировку до ручного probe:
  summary `8C41156A0C0AA1` (`type=1`, `subtype=8`, `detailType=1`,
  `version=10`) и details `8C41156A0C03A0` (`type=1`, `subtype=8`,
  `detailType=0`, `version=3`).
- Оба sports-файла пришли полностью: `crc=true`, `parsed=true`; details дал
  `193` точки пульса. API сохранил тренировку 26.05:
  duration `3` мин, calories `12`, HR `58/62/67`, samples `193`.
- Новая запись сразу создана текущей логикой корректно:
  `workoutType=freestyle`, `workoutProfile.id=gym`,
  `dataCompleteness=complete`, `missingMetrics=[]`.
- Raw cache подтвердил цепочку `captured -> submitted -> acked`; sports-файлы
  вошли в `ackFileIds`. Поэтому последующий ручной probe по тому же дню уже
  увидел только дневной summary-файл. Это ожидаемо и подтверждает, что ACK
  работает.

Проверка после установки новой сборки 26.05 в 14:23 EEST:

- Обычная синхронизация часов прошла успешно: показатели дня обновились
  (`heartRate`, `SpO2`, `stress`, шаги), служебный канал обновил время и
  погоду.
- Inventory часов: `total=7`, `selected=3`,
  breakdown `0/0/0/v3:3;0/0/1/v5:2;0/6/0/v2:1;0/8/1/v4:1`.
  Sports-файлов `type=1` в списке не было.
- Прочитанные файлы: дневной summary `50B8146A0C0501` и минутные activity
  `887F156A0C0300`, `107F156A0C0300`; все `crc=true`, `parsed=true`.
- Вывод: если тренировка видна в меню часов, но в PERFORM после sync нет новой
  тренировки, текущий raw-слой не получает от часов sports-файл. В таком случае
  parser/UI нечего сохранять. Следующая проверка должна смотреть именно
  inventory до ACK и сравнивать его с Mi Fitness/Gadgetbridge на той же свежей
  тренировке.
- UI после профильной логики проверен: `freestyle` выводит старт,
  длительность, калории, пульс и точки; дистанцию/шаги не показывает. График
  тренировки открывается быстро, шкала ЧСС адаптивная.
- Для run/walk добавлен fallback темпа/скорости: если часы отдали дистанцию и
  длительность, но не отдельное поле pace/speed, PERFORM рассчитывает их при
  сохранении raw summary и при отображении старых записей.

Повторная сверка PERFORM / Gadgetbridge / Mi Fitness 26.05 в 14:29-14:34 EEST:

- PERFORM после ручного sync получил inventory `total=7`, `selected=3`,
  breakdown `0/0/0/v3:3;0/0/1/v5:2;0/6/0/v2:1;0/8/1/v4:1`.
  Выбранные файлы: `5882156A0C0300`, `E081156A0C0300`,
  `50B8146A0C0501`. Все они относятся к daily/minute activity; sports
  `type=1` в inventory не было.
- Gadgetbridge на тех же часах был подключен (`Соединено`) и после ручного
  sync увеличил raw-cache с `71` до `76` файлов, но добавил только
  `ACTIVITY_DAILY` и `ACTIVITY_SLEEP`:
  `ACTIVITY_DAILY/DETAILS`, `ACTIVITY_DAILY/SUMMARY`,
  `ACTIVITY_SLEEP/SUMMARY`. Новых `SPORTS_*` файлов не появилось,
  `base_activity_summary` остался `1`.
- Mi Fitness / Zepp Life (`com.xiaomi.hm.health`) установлен, но находится на
  экране входа; приложение не `debuggable`, поэтому его базу нельзя прочитать
  через `run-as`. Для прямого сравнения нужен вход в аккаунт Mi Fitness или
  ручная проверка его UI после подключения часов.
- Повторная проверка после установки/запуска Mi Fitness: пакет на телефоне есть
  (`versionName=6.16.0`), Android-разрешения для Bluetooth/location выданы, но
  приложение по-прежнему открывает `LoginActivity` с полями email/пароль.
  Системный Xiaomi-аккаунт на телефоне виден, но Mi Fitness не перешел в
  авторизованный экран автоматически. Значит Mi Fitness пока нельзя использовать
  как эталон, пока пользователь не войдет в приложение.
- Уточнение: это был не Mi Fitness, а старый пакет `com.xiaomi.hm.health`.
  Правильный Mi Fitness на этом телефоне - `com.xiaomi.wearable`
  (`versionName=3.55.0i`).
- Проверка правильного Mi Fitness 26.05: приложение открыто на
  `com.xiaomi.fitness.main.MainActivity`, часы `Redmi Watch 5` отображаются как
  `Подключено`, заряд `38%`. После ручной синхронизации в разделе
  `Тренировка -> История -> Все` за май отображается только одна тренировка:
  `Ходьба`, `9.82 км`, `09.05`; сводка месяца: `1 тренировка`,
  `02:29:37`, `1385 ккал`. Свежей тренировки за 26.05 Mi Fitness тоже не
  показывает.
- Текущий вывод: проблема не похожа на ошибку parser'а PERFORM. Независимый
  Gadgetbridge тоже не увидел новую тренировку как sports-файл. Значит
  следующий раз проверять надо момент появления тренировки на часах до ACK:
  inventory PERFORM, затем sync Gadgetbridge, затем Mi Fitness UI, если он
  авторизован.

Протокол проверки следующей свежей тренировки:

1. До старта проверки остановить приложения, которые могут первыми отправить
   ACK: Mi Fitness и Gadgetbridge. PERFORM оставить первым клиентом.
2. Сразу после завершения тренировки на часах открыть PERFORM и запустить
   синхронизацию часов.
3. В логах смотреть только фактический inventory:
   - есть ли `type=1` sports-файлы;
   - какие `subtype`, `detailType`, `version`;
   - какие file IDs попали в read queue;
   - есть ли `crc=true`, `parsed=true`, `submitted`, `acked`.
4. Если sports-файлы появились и PERFORM сохранил тренировку - проверить
   карточку тренировки: длительность, калории, пульс, зоны, дистанция/шаги
   только для нужного профиля.
5. Если sports-файлов нет - не менять parser. После этого запустить
   Gadgetbridge sync и Mi Fitness sync и сравнить: видят ли они эту же
   тренировку. Если не видят, проблема на стороне выдачи/ACK очереди часов, а
   не PERFORM.
6. Если Mi Fitness видит, а PERFORM/Gadgetbridge не видят - тогда искать
   другой слой протокола Xiaomi, через который официальный клиент забирает
   workout history.

Приоритет 3 - сон и история:

- Логировать unsupported sleep file versions.
- Хранить raw metadata последней синхронизации.
- В 30-day history читать только доступные IDs и точно показывать, почему дни
  отсутствуют.

Приоритет 4 - служебная синхронизация:

- Оставить weather bridge, но показывать понятный статус:
  - connected;
  - bridge alive until;
  - last weather push;
  - last watch request.

Приоритет 5 - UI/performance:

- Оставить lazy graph expansion.
- Использовать chart-ready cache для тренировок.
- Во вкладке "Часы" параметры идут первыми, настройки в отдельном экране.
- Открытие карточки тренировки не должно зависеть от генерации графиков.

Проверка свежей тренировки 26.05:

- Mi Fitness (`com.xiaomi.wearable`) уже авторизован и видит свежую тренировку:
  `Произвольная активность`, `26.05.2026 15:03`, длительность `00:02:55`,
  средний пульс `79 BPM`, калории `15/20 ккал`.
- PERFORM до чтения файлов не дошел: не получил `watch nonce`, значит parser
  тренировки не запускался.
- После добавления retry SPP-соединения PERFORM действительно открывает RFCOMM
  на второй попытке (`socket connected. mPort=5`), но примерно через 0.3-0.6 c
  системный Xiaomi Continuity/Mi Connect (`com.xiaomi.mi_connect_service`,
  UID 1000) открывает тот же SPP UUID `00001101`, Android закрывает наш канал,
  и auth обрывается до `watch nonce`.
- Отключить `com.xiaomi.mi_connect_service` через `pm disable-user` нельзя:
  Android возвращает `Cannot disable system packages`. Временный `appops`
  запрет `BLUETOOTH_CONNECT/SCAN` тоже не помогает, системный UID продолжает
  открывать RFCOMM.
- Это значит, что текущий блокер на Xiaomi-телефоне - не формат workout-файла,
  а эксклюзивное владение SPP-каналом системным Xiaomi сервисом. Следующая
  архитектурная развилка: либо тестировать direct SPP на телефоне без Xiaomi
  Continuity/Mi Connect, либо делать интеграцию через официальный источник
  данных/Health Connect, либо искать режим, в котором часы не обслуживаются
  системным Xiaomi companion-сервисом.

Дополнительная проверка 26.05 после правок PERFORM:

- JS-кнопки `Обновить` и `полная синхронизация` переведены на единый маршрут:
  сначала `syncService` открывает одну SPP-сессию, внутри нее читает activity
  inventory/files, затем отправляет время/погоду. Старый маршрут
  `activity-probe -> service-sync` больше не используется для основной кнопки.
- Исправлено определение SPP v2: версия Xiaomi может приходить как `3.0.29`,
  а не только hex. При пустом ответе версии для Redmi Watch 5 теперь пробуем
  SPP v2, а не v1.
- Реальный лог после сборки: старого `activity-probe` нет, PERFORM открывает
  только `service-sync`, но `com.xiaomi.mi_connect_service` всё равно
  поднимает свой SPP-клиент сразу после нашего подключения. Наш сокет получает
  `Broken pipe` / закрытие канала до `watch nonce`.
- `cmd package suspend --user 0 com.xiaomi.mi_connect_service` не заморозил
  системный пакет (`new suspended state: false`). `am force-stop` тоже не
  помогает: HyperOS сразу поднимает Mi Connect заново и он снова занимает SPP.
- Практический вывод: на текущем Xiaomi/HyperOS телефоне direct SPP не станет
  стабильным без отключения системного Mi Connect для пользователя или без
  переноса теста на Android-телефон, где нет Xiaomi Continuity/Mi Connect.

Проверка после удаления Mi Fitness 26.05:

- `com.xiaomi.wearable` удален. После этого PERFORM Sync смог пройти полный
  SPP v2 auth и выполнить единый service-sync без старого обрыва на
  `watch nonce`.
- PERFORM inventory за `2026-05-26`: `total=4`, `selected=4`,
  breakdown `0/0/0/v3:3;0/0/1/v5:1`.
- Прочитанные файлы:
  - `50B8146A0C0501` - дневной summary v5;
  - `64A3156A0C0300` - daily details v3;
  - `ECA2156A0C0300` - daily details v3;
  - `008F156A0C0300` - daily details v3.
- Все файлы пришли `complete`, `crc=true`, `parsed=true`. После этого PERFORM
  обновил время и погоду, а UI показал свежие пульс, SpO2, стресс и шаги.
- Sports/workout файлов `type=1` в inventory не было, поэтому новых тренировок
  PERFORM сохранить не мог.
- Контроль через Gadgetbridge на том же телефоне и тех же часах: sync увеличил
  raw-cache `76 -> 77`, но добавил только
  `ACTIVITY/ACTIVITY_DAILY/DETAILS/20260526T164700_00_00_00_v3.bin`.
  Новых `SPORTS/...` файлов за 26.05 Gadgetbridge тоже не получил.
- В базе Gadgetbridge `BASE_ACTIVITY_SUMMARY` осталась одна старая тренировка:
  `2026-05-23 21:12:39 -> 21:35:31`.

Вывод этой проверки:

- direct PERFORM Sync после удаления Mi Fitness работает для дневных данных.
- Новая тренировка, сделанная при установленном Mi Fitness, скорее всего уже
  была прочитана/подтверждена официальным клиентом и больше не отдается через
  обычный `today/history` file queue.
- Следующий честный тест тренировки: сделать короткую тренировку уже без
  Mi Fitness и без предварительного sync Gadgetbridge, затем первым запустить
  PERFORM. Если `SPORTS` появится - текущий parser должен сохранить тренировку.
  Если `SPORTS` не появится - надо разбирать live-workout слой
  `WorkoutOpenWatch` / `WorkoutStatusWatch` и искать, использует ли официальный
  клиент отдельный путь для завершенных тренировок.

Чистый тест новой тренировки без Mi Fitness/Gadgetbridge, 26.05 17:12:

- Перед тестом остановлены Gadgetbridge и Zepp Life; `com.xiaomi.wearable`
  удален. PERFORM запущен первым клиентом после новой тренировки на часах.
- PERFORM inventory за `2026-05-26`: `total=5`, `selected=5`,
  breakdown `0/0/0/v3:2;0/0/1/v5:1;1/8/0/v3:1;1/8/1/v10:1`.
- Sports-файлы тренировки появились в inventory:
  - `36A7156A0C0AA1` - workout summary v10, timestamp
    `2026-05-26T13:59:18Z`;
  - `36A7156A0C03A0` - workout details v3, timestamp
    `2026-05-26T13:59:18Z`.
- Оба sports-файла пришли `complete`, `crc=true`, `parsed=true`; details
  размером `2099` bytes.
- UI после sync показал: `1 тренировка`. В списке тренировок появилась новая
  `Свободная тренировка 16:59-17:08`: длительность `8 мин`, пульс `64/65 ср.`,
  `33 ккал`.
- Детальная карточка тренировки открылась без зависания: старт `16:59`,
  длительность `8 мин`, калории `33`, пульс `62-74`, SpO2 `95-97%`,
  `514` точек.
- Экран графика открылся: `514 точек ЧСС`, на графике `188` ключевых точек,
  min/avg/max `62/65/74`; зона 1 - `8:42` и `100%`.

Вывод чистого теста:

- PERFORM Sync корректно забирает новую тренировку, если он первый клиент после
  завершения тренировки на часах.
- Предыдущая пропажа тренировки была не проблемой parser'а, а эффектом того,
  что Mi Fitness/Gadgetbridge могли уже прочитать и ACK-нуть sports-файлы.
- Для дальнейших тестов тренировок нельзя запускать Mi Fitness/Gadgetbridge до
  PERFORM. В интерфейсе стоит добавить понятную диагностику: если дневные
  данные пришли, но `SPORTS` нет, вероятно тренировку уже забрал другой клиент.

Погода на часах, 27.05:

- Сверка с Gadgetbridge показала, что PERFORM отправляет тот же базовый набор
  Xiaomi Weather:
  - current: температура, влажность, ветер по шкале Бофорта + направление,
    UV, AQI, давление;
  - daily: AQI, состояние, min/max температура, восход и закат;
  - hourly: AQI, состояние, температура, ветер;
  - location/order/prefs/temp-unit.
- Важная правка: Open-Meteo отдает `sunrise/sunset` как локальное время
  погодной точки. Теперь PERFORM форматирует эти значения с
  `utc_offset_seconds` из ответа Open-Meteo, а не через timezone телефона.
- Проверка на подключенном Android:
  - геолокация телефона: `София, Болгария`;
  - payload: `temp=18`, `humidity=68`, `wind=1/217`, `uv=0`, `aqi=20`,
    `pressure=1022.1`;
  - восход/закат: `2026-05-27T05:53:00+03:00` /
    `2026-05-27T20:53:00+03:00`;
  - service sync отправил время и погоду без ошибки.

Дополнительная сверка без телефона, 27.05:

- Daily summary parser расширен по Gadgetbridge: PERFORM теперь принимает
  версии `v3` и `v5`. В `v3` сохраняются шаги, калории, ЧСС, стресс и SpO2;
  `trainingLoad`/`vitality` остаются пустыми, потому что в этом формате их нет.
- Native `DirectWatchSyncCoordinator` получил явные причины блокировки,
  `retryAfterMs`, 5-минутный backoff после ошибок и очистку pending request
  старше 10 минут.
- UI тренировок получил кэш готовых graph-series и детального HTML графика ЧСС:
  это уменьшает повторные пересчеты при возврате из карточки тренировки и при
  переключениях истории.
