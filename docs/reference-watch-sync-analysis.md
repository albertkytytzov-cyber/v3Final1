# Reference Watch Sync Analysis

Updated: 2026-06-01

Goal: stop guessing about watch background behavior. Use:

- Gadgetbridge as the open-source technical reference.
- Mi Fitness as the installed behavioral reference.
- PERFORM Sync as the implementation we compare against.

Huawei watches are tracked separately because their first integration path is
Huawei Health Kit rather than Xiaomi-style raw watch files. See
`docs/huawei-band-11-pro-test-plan.md`.

No DirectWatch code changes should be made from this document alone. The next
implementation step should be based on the gaps below.

## Installed App Facts From Android Dumpsys

Packages checked:

- PERFORM: `com.perform.training`
- Mi Fitness: `com.xiaomi.hm.health`
- Gadgetbridge: `nodomain.freeyourgadget.gadgetbridge`

| Layer | PERFORM Sync | Mi Fitness | Gadgetbridge |
| --- | --- | --- | --- |
| Runtime service seen by Android | `DirectWatchForegroundService`, foreground, `connectedDevice` | `HMCoreService`, long-lived keep-alive service | no active service at the moment of capture, but manifest has `DeviceCommunicationService` |
| Observed service age | active foreground during test | `HMCoreService` record existed for more than 2 days | inactive in current capture |
| Boot receiver | yes: `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED` | yes: `SystemRebootReceiver` | yes in app manifest |
| Bluetooth receiver | yes: adapter state, connection state, ACL connected | yes: Bluetooth on/off receiver for device stack | yes: global Bluetooth receiver plus service receivers |
| Unlock/user-present trigger | yes | not visible in package dump as direct public receiver | yes: auto fetch on `USER_PRESENT` |
| Time/timezone trigger | currently no manifest-level time/timezone receiver | yes: `TimeChangedReceiver`, `TimeZoneReceiver` | yes: `TimeChangeReceiver`, periodic DST/time sync |
| Exact alarm permission | not declared | declares `SCHEDULE_EXACT_ALARM` | declares `SCHEDULE_EXACT_ALARM` |
| Ignore battery optimization permission | not declared | not visible in captured permissions | declares `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` |
| Background location | not declared | declared but not granted in capture | declared and granted in capture |
| Current scheduling | `AlarmManager.setAndAllowWhileIdle`, 10 min gate | proprietary `HMCoreService` keep-alive | foreground service + reconnect alarm + unlock auto fetch |

Main fact: Mi Fitness and Gadgetbridge are both service-first designs. PERFORM
is now also service-first, but still has fewer Android-level system hooks than
the references.

## Gadgetbridge Technical Model

### Lifecycle

Gadgetbridge creates a central `DeviceCommunicationService` and starts it as a
foreground service. It becomes the single owner of device communication.

Important code references:

- `GBApplication.java`: registers Bluetooth state receiver during app startup.
- `DeviceCommunicationService.java`: starts foreground service, registers
  external receivers, routes all device actions.
- `BluetoothStateChangeReceiver.java`: reconnects when Bluetooth becomes ON.
- `AutoConnectIntervalReceiver.java`: reconnect alarm with exponential backoff.
- `GBAutoFetchReceiver.java`: auto fetch on phone unlock with a configurable
  minimum interval.
- `TimeChangeReceiver.java`: time/timezone/DST sync with wake lock and periodic
  reschedule.

### Data Sync

Gadgetbridge does not let UI own the sync. The service routes:

1. fetch recorded data;
2. request activity file list;
3. queue unique file IDs;
4. read one file at a time;
5. collect chunks;
6. validate CRC;
7. parse;
8. ACK or keep on device depending on preference;
9. move to next file.

Important code references:

- `XiaomiHealthService.java`
- `XiaomiActivityFileFetcher.java`
- `XiaomiActivityParser.java`
- parsers under `service/devices/xiaomi/activity/impl/`

### Sleep Data Rules

Reference files checked:

- `SleepDetailsParser.java`
- `SleepStagesParser.java`

The important point for PERFORM: Xiaomi sleep files have two different layers,
and they must not be mixed.

| Source | Gadgetbridge behavior | PERFORM rule |
| --- | --- | --- |
| `type=0/subtype=8`, packet `type=16` | Authoritative sleep summary: total sleep, awake, light, REM, deep | Use these fields as the main summary |
| `type=0/subtype=8`, packet `type=17` | Stage-change samples: stage code plus offset minutes | Treat as timeline samples only; do not blindly sum offsets into total sleep |
| `type=0/subtype=3/version=2` | Separate sleep stages file with direct totals for sleep/deep/light/REM/awake | Parse direct totals by field order |
| CRC-false file read | Not a safe final file | Do not block a later CRC-true retry |

Regression that was found on 2026-06-01:

- One watch sleep file (`9CA01C6A0C0421`) was fully read with CRC OK.
- It contained valid summary data: sleep `364` min, light `364` min, awake
  `120` min.
- It did not contain credible deep/REM totals. The app must show that deep/REM
  were not provided by the watch instead of inventing them from noisy stage
  samples.

Guardrails now expected in PERFORM:

- sleep duration excludes awake time;
- stage packet totals are accepted only if they are inside the sleep window,
  close to the summary duration and contain useful deep or REM detail;
- short/partial sleep packets do not overwrite a full night;
- incoming null deep/REM values do not erase existing deep/REM values;
- CRC-false attempts do not suppress a later successful CRC-true file.

### Weather

Gadgetbridge sends the same Xiaomi protobuf layers PERFORM already targets:

- current weather;
- daily forecast;
- hourly forecast;
- location list / location order;
- temperature prefs.

It also responds to watch requests for conditions. This is important: weather
should not only be timer-driven. The watch can ask for conditions, and the phone
should answer while the service bridge is alive.

Important code references:

- `XiaomiWeatherService.java`
- `xiaomi.proto`, weather messages.

## Mi Fitness Behavioral Model

Mi Fitness is closed, so we do not copy code. What we can observe:

- It has a public `HMCoreService` with actions:
  - `HMCoreService`
  - `HMCoreService.KEEP_ALIVE`
  - `HMCoreService.SYNC_DATA`
  - `HMCoreService.START_FOREGROUND`
  - `HMCoreService.STOP_FOREGROUND`
- It registers system receivers for:
  - boot;
  - phone state;
  - language;
  - time changed;
  - timezone changed;
  - Bluetooth on/off for the device stack.
- Android kept a service record for Mi Fitness for more than two days in the
  captured dump.

Practical conclusion: official behavior is not “wake WebView every N minutes”.
It is a central device service that is allowed to keep device state warm and
react to system events.

## PERFORM Current Model

What is already close to the references:

- `DirectWatchForegroundService` is foreground and `connectedDevice`.
- `DirectWatchSyncCoordinator` owns a 10-minute gate and failure backoff.
- `DirectWatchSyncReceiver` reacts to boot, package replace, unlock, Bluetooth
  on/reconnect and alarm timer.
- Native sync performs:
  - Bluetooth Classic/SPP connect;
  - auth;
  - time/weather commands;
  - daily/sleep/activity/workout file reading;
  - service bridge keep-alive;
  - watch weather request handling;
  - activity refresh every 10 minutes while bridge is alive.
- Activity files are requested sequentially with CRC and retry.
- Background store records separate timestamps for weather and data.

Important current files:

- `apps/mobile/android/app/src/main/java/com/perform/training/DirectWatchForegroundService.kt`
- `apps/mobile/android/app/src/main/java/com/perform/training/DirectWatchSyncCoordinator.kt`
- `apps/mobile/android/app/src/main/java/com/perform/training/DirectWatchSyncReceiver.kt`
- `apps/mobile/android/app/src/main/java/com/perform/training/DirectWatchPlugin.kt`
- `apps/mobile/android/app/src/main/AndroidManifest.xml`

## Gaps Before Next Implementation

| Gap | Why It Matters | Reference |
| --- | --- | --- |
| No manifest-level time/timezone receiver | If phone timezone/time changes while app/service is not warm, watch time/weather freshness can drift | Mi Fitness `TimeChangedReceiver` / `TimeZoneReceiver`; Gadgetbridge `TimeChangeReceiver` |
| No explicit battery optimization request path | Xiaomi/HyperOS may still freeze background starts or network/weather refresh | Gadgetbridge declares `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` and documents background service handling |
| Service is foreground, but not clearly “single owner” in product state | Some manual/WebView flows can still compete with native sync | Gadgetbridge routes all device commands through one `DeviceCommunicationService` |
| Weather refresh is good while bridge is alive, but not yet proven after overnight idle | The user’s actual issue is overnight weather not updating | Mi Fitness keeps `HMCoreService`; Gadgetbridge uses service + event receivers |
| No periodic time/DST resync separate from 10-min data sync | Time should be its own low-frequency lifecycle event, not only part of data sync | Gadgetbridge schedules periodic DST/time sync |
| Current Android permission set is smaller than references | Some behavior is impossible or restricted without explicit permissions/settings | Gadgetbridge/Mi Fitness declare exact alarm and more background-related permissions |

## Recommended Architecture Change

Keep PERFORM's current native sync, but tighten it into a reference-style device
service:

1. Treat `DirectWatchForegroundService` as the only owner of the watch channel.
2. Add manifest-level receivers for time/timezone changes.
3. Add an explicit battery optimization/HyperOS checklist in app diagnostics.
4. Split sync reasons internally:
   - time sync;
   - weather sync;
   - activity sync;
   - workout file sync;
   - reconnect.
5. Keep weather request handling inside the active bridge.
6. Keep sequential file queue with CRC/retry.
7. Keep ACK stricter than Gadgetbridge: only after save/offline queue.
8. Make UI read service status only, never decide whether the protocol should
   continue.

## Implementation Order

1. Add time/timezone receiver and route it to native service.
2. Add exact-alarm/battery optimization diagnostics and a clear user-facing
   status if Android blocks background.
3. Refactor DirectWatch status into a state machine:
   - `idle`;
   - `connecting`;
   - `authenticated`;
   - `weather-sent`;
   - `activity-reading`;
   - `waiting-next-sync`;
   - `blocked-by-android`;
   - `bluetooth-busy`;
   - `error`.
4. Keep the existing 10-minute weather/data bridge, but make service restart
   after Android kill more explicit.
5. Only after that run a long background test.

## Applied Implementation Package 2026-06-01

Implemented from the reference gaps above:

- `AndroidManifest.xml` now declares:
  - `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`;
  - `SCHEDULE_EXACT_ALARM`;
  - receivers for `TIME_CHANGED`, `TIMEZONE_CHANGED`, `DATE_CHANGED`.
- `DirectWatchForegroundService` dynamically listens to the same time/date
  events while the foreground service is already alive.
- `DirectWatchSyncCoordinator` maps those events to explicit reasons:
  - `time-changed`;
  - `timezone-changed`;
  - `date-changed`.
- Time/date/package/boot events bypass the 10-minute gate because the watch
  needs immediate time/weather refresh after those system events.
- `DirectWatchAndroidPowerStatus` reports Android-level background blockers:
  - battery optimization whitelist state;
  - power save mode;
  - background restriction;
  - exact alarm capability;
  - Xiaomi/Redmi/Poco aggressive battery vendor hint.
- The mobile watch diagnostics UI now shows this as a plain user-facing
  Bluetooth/background status instead of hiding Android restrictions behind
  technical logs.

No phone installation was done during this package. Verification was local:

- `npm run typecheck --workspace @training-platform/mobile`
- `npm run test`
- `npm run sync:android --workspace @training-platform/mobile`
- `./gradlew :app:assembleDebug`
- merged manifest check for the new permissions and time/date receivers

Result: APK builds successfully and is ready for device testing when approved.

## Product Conclusion

We should not copy Mi Fitness. We cannot inspect its real code safely, and it
uses private Xiaomi internals.

We should not blindly embed Gadgetbridge into production because of AGPL.

We should copy the verified architecture:

- central native service;
- system event receivers;
- reconnect/backoff;
- unlock fetch;
- time/timezone receiver;
- watch-request weather response;
- sequential file queue;
- CRC before parse;
- ACK only after safe save.
