# Watch Sync Reliability Matrix

Цель: PERFORM Sync не должен зависеть от открытого WebView. Android-native service является владельцем Bluetooth-очереди, а WebView только показывает статус, прогресс, ошибки и ручные команды.

| Событие | Что должен сделать PERFORM | Типы sync | Как проверить без телефона | Как проверить на телефоне |
|---|---|---|---|---|
| Ручная синхронизация | Поставить задачу в `DirectWatchForegroundService`, не запускать отдельную WebView BLE-сессию | `time-sync`, `weather-sync`, `daily-sync`, `workout-sync` | `requestCoordinatorSync` возвращает `syncTypes`, сервис получает intent даже если уже запущен | Нажать `Синхронизировать сейчас`, статус меняется: очередь -> подключение -> погода/данные |
| Ручное обновление погоды | Native service отправляет время, локацию и погоду без обязательного чтения файлов активности | `time-sync`, `weather-sync` | reason `manual-weather-sync` даёт `shouldFetchActivityForReason=false` | На часах обновляются температура/город/прогноз без долгого чтения тренировок |
| Таймер службы | Каждые 10 минут или после backoff native service сам запускает очередь | `time-sync`, `weather-sync`, `daily-sync`, `workout-sync` | `DirectWatchSyncAlarmScheduler` ставит alarm, `service-timer` попадает в coordinator | Не открывать приложение 30-60 минут, проверить погоду и время последней синхронизации |
| Возврат в приложение | WebView только будит coordinator и обрабатывает готовый background result | `time-sync`, `weather-sync`, `daily-sync`, `workout-sync` | `notifyAppVisible` вызывает native service, если request создан | Открыть приложение после паузы, статус показывает последнюю попытку и результат |
| Разблокировка телефона | Broadcast `USER_PRESENT` запускает native sync с учётом интервала/backoff | `time-sync`, `weather-sync`, `daily-sync`, `workout-sync` | reason `user-present` проходит через `handleBroadcast` | Разблокировать телефон после паузы, погода/данные обновляются без ручной кнопки |
| Bluetooth включён/reconnect | Native service делает reconnect, затем время/погода/данные | `reconnect`, `time-sync`, `weather-sync`, `daily-sync`, `workout-sync` | reasons `bluetooth-on`, `bluetooth-reconnect` дают `reconnect` в `syncTypes` | Выключить/включить Bluetooth, проверить статус reconnect и обновление часов |
| Смена времени/таймзоны/даты | Приоритетно отправить время и погоду, не тянуть тяжёлую историю | `time-sync`, `weather-sync` | reasons `time-changed`, `timezone-changed`, `date-changed` не читают activity | Изменить часовой пояс/дату, часы получают корректное время |
| Запрос погоды от часов | Bridge отвечает локацией и weather payload, пишет `weatherUpdatedAt` | `weather-sync` | `service-bridge` пишет `recordServiceSync` при weather request | На часах открыть погоду, статус обновляет “погода отправлена” |
| Bluetooth занят | Не запускать вторую сессию, показать причину и поставить retry/backoff | current state `bluetooth-busy` | `DirectWatchBluetoothSyncLock.isBusy()` пишет статус и backoff | Во время синхронизации нажать ещё раз, приложение пишет “Bluetooth занят, повторим позже” |
| Android ограничил фон | Диагностика показывает power save, background restriction, exact alarm и Xiaomi battery hint | диагностика | `DirectWatchAndroidPowerStatus.status` возвращает поля в UI | Проверить блок `Bluetooth / фон` в настройках часов |
| Неполный пакет данных | Не затирать более полный день: обновлять только реально пришедшие поля | data protection | тесты защиты daily merge проходят | Повторная синхронизация не уменьшает шаги/сон/пульс без причины |
| Файлы тренировки | Читать список, chunks, CRC, parser; ACK только после сохранения | `workout-sync` | parser coverage и raw activity probe логируются | Сделать тренировку, синхронизировать, проверить карточку и отсутствие дублей |
| API offline | Не ACK на часы до успешного сохранения или queued raw cache | queue/ACK | raw cache получает `queued`, ACK откладывается | Отключить сеть, синхронизировать, затем включить сеть и проверить отправку |

## Статусы для интерфейса

| State | Значение для пользователя |
|---|---|
| `queued` | Запрос поставлен в очередь |
| `connecting` | Подключаемся к часам |
| `connected` | Bluetooth подключён |
| `authorizing` | Авторизуемся в протоколе часов |
| `authorized` | Часы авторизованы |
| `weather-sent` | Время, локация и погода отправлены |
| `activity-reading` | Читаем показатели и тренировки |
| `bluetooth-busy` | Bluetooth занят, повторим позже |
| `waiting-next-sync` | Ожидаем следующее обновление |
| `error` | Ошибка синхронизации |
