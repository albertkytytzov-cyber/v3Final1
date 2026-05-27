# PERFORM Sync / Background Sync Plan

Обновлено: 2026-05-27

Эта заметка фиксирует текущую архитектуру фоновой синхронизации часов, чтобы
дальше не смешивать реальные проверки на телефоне с задачами, которые можно
делать без участия спортсмена.

## Что уже вынесено в Android

Нативный слой `DirectWatchSyncCoordinator` отвечает за решение, когда нужно
попросить WebView выполнить синхронизацию:

- запуск/работа foreground service;
- возврат приложения на экран;
- разблокировка телефона;
- включение Bluetooth;
- reconnect Bluetooth;
- перезапуск приложения после обновления;
- boot телефона;
- ручной запрос из UI.

WebView остается интерфейсом и адаптером API: показывает статус, прогресс,
ошибки, кнопку, а также пока формирует payload для API. Полный перенос
payload/API submit в native слой оставлен отдельным большим этапом.

## Правило интервала

Интервал фоновой синхронизации считается не от факта запроса, а от последней
успешной синхронизации.

Правила:

- после успешной синхронизации следующий авто-запрос блокируется на 30 минут;
- после ошибки используется короткий backoff 5 минут;
- быстрые повторы одного и того же события блокируются на 2.5 секунды;
- если WebView не готов или приложение занято, pending request сохраняется и
  переотдается следующему listener/event, а не теряется.
- pending request старше 10 минут считается протухшим и очищается, чтобы старый
  запрос не запускался бесконечно после нескольких возвратов в приложение.

Это важно: Bluetooth/часы могут дать временную ошибку, и приложение не должно
замолкать на 30 минут только потому, что попытка уже была создана.

## Очередь данных

Целевая модель остается одна:

1. auth;
2. список файлов активности;
3. чтение файлов строго по одному;
4. сбор chunks;
5. CRC;
6. parser;
7. сохранение в API или offline queue;
8. ACK только после успешного сохранения;
9. служебные команды времени/погоды.

В текущей реализации чтение файлов уже идет по очереди в Android:
`requestClassicActivityFilesSequentially`. ACK в WebView допускается только
после `submitDeviceHealthPayload` и `submitDeviceWorkoutsPayload`.

## Защита от перезаписи данных

Сохраняем правило: неполные данные не затирают более полные.

Сейчас это закрыто на уровне mobile snapshot:

- raw steps из `minute-details-partial` не заменяют дневной итог;
- шаги, калории, training load и vitality берутся как лучший/максимальный
  достоверный итог;
- на API длительность сна также не уменьшается от более короткого incoming
  пакета: `sleep_duration_minutes` обновляется через максимум, а не слепую
  замену;
- новые samples заменяют старые только если новых точек не меньше, иначе
  добавляются без удаления старого набора;
- тренировки дедуплицируются по display key, оставляется более полная версия.

## Что можно делать без телефона

1. Укреплять native-координатор:
   - причины блокировки;
   - pending/retry;
   - backoff после ошибок;
   - статус для UI.

2. Доводить parser coverage:
   - сверять Xiaomi subtype/version с Gadgetbridge;
   - расширять summary-parser только по подтвержденным форматам;
   - не трогать ACK-логику без теста сохранения.

3. Оптимизировать UI и графики:
   - убрать тяжелые пересчеты при открытии списка тренировок;
   - кешировать готовые серии графиков;
   - держать uPlot/Canvas-рендер стабильным.

4. Чистить импорт шаблонов:
   - `Блок | Объём`;
   - без `Контроль`;
   - общие комментарии отдельно;
   - проверка дней 18.05, 26.05, 29.05.

5. Готовить тесты и документацию:
   - typecheck;
   - Android assemble;
   - import-template check;
   - список ручных проверок для телефона.

## Что закрыто 27.05 без телефона

- native-координатор теперь отдаёт UI причину блокировки, `retryAfterMs`,
  `nextAllowedAt`, возраст pending request и время последней успешной
  синхронизации;
- после ошибки применяется 5-минутный retry/backoff, а не общий 30-минутный
  интервал успешной синхронизации;
- если WebView уже занят ручной/исторической/автоматической синхронизацией,
  native request не теряется: WebView ставит короткий retry на 15 секунд и
  повторяет pending request;
- автозапуск считается успешным не только когда пришли новые файлы для API, но
  и когда служебная синхронизация часов обновила время/погоду. Это не даёт
  статусу ошибочно показывать `skipped` при нормальном service-sync;
- `syncService` помечает запуск как `started` только после проверки Bluetooth,
  валидного `deviceId` и системного сопряжения. Ошибки до подключения больше не
  оставляют ложный статус "синхронизация уже идёт";
- importer больше не протаскивает старую колонку `Контроль` как отдельную
  колонку упражнения: такие значения становятся общим примечанием дня;
- экран тренировок кеширует подготовленные серии графиков и HTML детального
  графика ЧСС, чтобы возврат в список/карточку не пересчитывал тяжелые точки.

### Performance guard audit, 27.05.2026

No UI layout changes were made in this pass. The check is intentionally about
the heavy paths only:

- history groups are cached by workout array, athlete, date and period, so
  switching day/week/month does not rescan the same snapshot repeatedly;
- graph series are cached per workout and context, with a small per-workout
  eviction limit;
- detail heart-rate HTML is cached, including the approved adaptive SVG chart;
- heavy render paths are capped: the regular chart series use
  `DEVICE_WORKOUT_SERIES_RENDER_LIMIT`, and the detailed heart-rate chart renders
  only key visible points;
- graph time parsing, display keys and duplicate-completeness scores are cached;
- uPlot charts are destroyed on rerender and remounted from prepared payloads.

The regression script `check:mobile-workout-performance` protects these guards
so future changes do not accidentally bring back slow week/month transitions.

## Что требует телефона

- реальная синхронизация часов;
- проверка погоды на циферблате;
- проверка времени на часах;
- проверка, что новая тренировка пришла из inventory;
- проверка foreground service через 10-30 минут;
- проверка поведения после закрытия приложения и reconnect Bluetooth.
