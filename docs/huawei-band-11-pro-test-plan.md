# Huawei Band 11 Pro Test Plan

Updated: 2026-06-04

Goal: prepare PERFORM for testing Huawei watches without repeating the Xiaomi
guesswork cycle. Huawei Band 11 Pro should be tested as a separate watch
provider and then normalized into the same PERFORM data model.

## Purchase Decision

Huawei Band 11 Pro is a suitable test device.

Why it is useful for PERFORM:

- It is an official Huawei wearable model, not a marketplace-only alias.
- It supports Android and iOS pairing through Huawei Health.
- It has built-in GNSS for outdoor workouts, so walking/running/cycling can be
  tested without relying only on phone GPS.
- It exposes the right athlete-monitoring categories in Huawei Health:
  heart rate, SpO2, sleep, sleep HRV, stress/recovery-style signals, workouts,
  calories, distance, pace/speed and daily activity.

Buying rules:

- Prefer an official EU/global model, not a region-locked China import, because
  Huawei Health Kit and AppGallery Connect availability can be region-sensitive.
- Keep the first test on Android. The iPhone path can be tested later through
  Apple Health, but Android gives us more integration options.
- Pair it first with the official Huawei Health app from AppGallery.
- Do not start by reverse-engineering BLE. Start with the official data layer.

## Huawei Is Not Xiaomi

Xiaomi path in PERFORM:

- direct native watch service;
- Xiaomi authentication key;
- Bluetooth/SPP protocol;
- file inventory, chunks, CRC, parser, ACK;
- PERFORM sends time/weather and reads raw activity files.

Huawei path should start differently:

- Huawei Health app remains the owner of the watch connection;
- Huawei Health syncs the watch data;
- PERFORM reads authorized data through Huawei Health Kit or platform health
  stores where available;
- only if official data is insufficient do we inspect direct BLE behavior.

This difference matters: for Huawei, the cleanest first product path is
provider integration, not a second DirectWatch raw-protocol implementation.

## Official Integration Layers

### 1. Huawei Health Kit

Primary Android path.

Expected use:

1. Register `com.perform.training` in AppGallery Connect.
2. Enable Health Kit and Account Kit.
3. Add the release/debug signing certificate fingerprint.
4. Request read permissions for:
   - daily activity;
   - workouts/activity records;
   - heart rate;
   - sleep;
   - SpO2;
   - distance;
   - calories;
   - route/GNSS data if available and allowed.
5. Place `agconnect-services.json` in the Android app.
6. Ask the athlete to authorize Huawei Health access in PERFORM.

Success criteria:

- PERFORM can read today's daily activity.
- PERFORM can read at least one historical sleep record with stages or an
  explicit signal that stages are unavailable.
- PERFORM can read heart-rate samples or a documented summary fallback.
- PERFORM can read a workout record and distinguish summary from graph samples.

### 2. Android Health Connect

Secondary Android path.

Use only as a fallback or comparison layer. Huawei Health may not write every
metric to Health Connect in every region or app version.

Success criteria:

- compare Huawei Health Kit results with Health Connect results for the same
  day;
- never trust Health Connect alone until the source package and metric coverage
  are verified.

### 3. Apple Health

Secondary iPhone path.

Use for iOS once Android coverage is understood. Huawei Health can sync some
data to Apple Health, but we must verify metric-by-metric.

Success criteria:

- sleep;
- heart rate;
- resting heart rate;
- SpO2;
- workouts;
- calories/distance/steps;
- source attribution.

### 4. Huawei Wear Engine

Official direct phone-watch SDK path, but not the same as Xiaomi raw file
sync.

Huawei documents Wear Engine as a way to share app features and services
between phones and wearables. The official feature list includes:

- paired wearable list;
- wearable status monitoring;
- health and fitness status monitoring;
- phone-watch message and file communication;
- sensor management for accelerometer and ECG/PPG-style signals.

This means Huawei does provide a direct SDK channel, but it is an approved
Huawei API layer, not arbitrary Bluetooth access to every private watch file.
The codelab flow also expects Huawei Health pairing/authorization and, for
phone-watch messages/files, a peer watch app package and certificate
fingerprint.

Direct-access reality check:

| Capability | Official path exists? | PERFORM meaning |
| --- | --- | --- |
| List paired Huawei wearables | yes, Wear Engine | Can detect selected Huawei device |
| Connection/battery/worn/charging status | yes, Wear Engine | Useful diagnostics |
| Message/file exchange with watch app | yes, Wear Engine | Needs compatible watch-side app/setup |
| Some health/fitness status monitoring | yes, Wear Engine | Must verify exact metric depth on Band 11 Pro |
| Sensor management | yes, Wear Engine | Potential live measurements, not guaranteed historical archive |
| Historical sleep/workout raw files like Xiaomi | not publicly proven | Needs device probe; do not assume |
| Time/weather ownership like Xiaomi DirectWatch | not publicly proven | Huawei Health may remain owner unless Wear Engine supports needed calls |

Use Wear Engine as the R&D path for `direct-huawei`, while Health Kit remains
the first stable product path for stored health/workout data.

## Unified PERFORM Provider Model

Add Huawei as a provider beside DirectWatch/Xiaomi:

| Provider | Owner of watch connection | PERFORM reads from | Main risk |
| --- | --- | --- | --- |
| `direct-xiaomi` | PERFORM native service | raw watch files | protocol changes, auth, CRC/parser coverage |
| `direct-huawei` | PERFORM native service or Huawei Wear Engine bridge | Wear Engine/live device APIs if supported | metric depth, watch-side app support, Huawei approval |
| `huawei-health-kit` | Huawei Health | Huawei Health Kit | region/app approval, permission coverage |
| `health-connect` | source app | Android Health Connect | partial metrics, source ambiguity |
| `apple-health` | source app | Apple HealthKit | partial metrics, source ambiguity |

Normalized PERFORM entities should stay the same:

- `DailyActivity`
- `SleepSummary`
- `SleepStages`
- `HeartRateSeries`
- `RestingHeartRate`
- `SpO2Series`
- `StressSeries`
- `WorkoutSummary`
- `WorkoutHeartRateSeries`
- `WorkoutRoute`
- `WorkoutZones`
- `WeatherSyncStatus` only for providers where PERFORM owns watch weather

Important rule: Huawei data should not be forced into Xiaomi diagnostics. The
UI should show provider-specific status:

- Xiaomi: service connected, weather sent, files read, CRC, parser, ACK.
- Huawei: Huawei Health authorized, last Huawei Health sync, Health Kit read,
  metric coverage, missing permissions.

## First Device Test Matrix

Run this after the Band 11 Pro is purchased and paired.

| Test | Expected Result | Notes |
| --- | --- | --- |
| Pair with Huawei Health on Android | Device connected and syncing | Use AppGallery Huawei Health |
| Manual Huawei Health sync | New data visible inside Huawei Health | Establish official baseline first |
| PERFORM authorization | User grants Health Kit access | No Huawei password stored by PERFORM |
| Daily activity read | steps/calories/distance for today | Compare values with Huawei Health |
| Sleep read | total sleep plus stages if exposed | Mark stages unavailable if not exposed |
| Heart-rate read | day series or summary fallback | Compare sample count and timestamps |
| SpO2 read | samples or summary fallback | Compare with Huawei Health |
| Stress/HRV read | available or explicitly unavailable | Do not invent unavailable metrics |
| Workout read: walking/running | distance, duration, calories, pace, HR if exposed | Built-in GNSS should help route testing |
| Workout read: strength/freestyle | duration, calories, HR; no forced distance | Same PERFORM profile rules as Xiaomi |
| Historical range | 7/14/30 days where API allows | Record API limits |
| Offline/late sync | PERFORM does not overwrite richer data with empty data | Same protection rule as Xiaomi |

## Product Recommendation

Buy Huawei Band 11 Pro for testing, but treat it as a provider-integration
test, not as another Xiaomi-style direct watch project.

The first implementation milestone should be:

1. finish the Huawei Health Kit Android setup;
2. read and normalize the same metrics PERFORM already understands;
3. show provider coverage in diagnostics;
4. compare Huawei values against Huawei Health for several days;
5. only then decide whether direct Huawei watch communication is necessary.

If Huawei Health Kit exposes enough workout and recovery data, it will be a
cleaner and safer path than raw BLE. If it does not expose enough detail, the
next step is a focused gap analysis, not immediate reverse engineering.

## First Android Probe 2026-06-04

Connected phone:

- Manufacturer/model: Xiaomi `2407FPN8EG`, Android `16`.
- PERFORM is installed and visible through ADB over USB and Wi-Fi.
- Huawei Health is installed: `com.huawei.health` version `16.1.4.310`.
- A separate `com.huawei.hwid` package is not installed on this phone.
- `agconnect-services.json` is not present in the Android project, so Huawei
  Health Kit authorization cannot be tested yet.

Observed Huawei watch:

- Android Bluetooth reports `HUAWEI WATCH FIT 4 Pro-2F6`, not Band 11 Pro.
- The device is bonded as `DUAL`.
- Android metadata marks it as `device_type=Watch`.
- Bluetooth diagnostics show successful encrypted classic connection,
  HID connection and RFCOMM channel opening.
- Huawei Health is running `DaemonService`, `PhoneService`,
  `HiHealthService` and `DevicesManagementService` as foreground/bound
  services.
- Huawei Health performs BLE scans filtered to the Huawei watch address.

Conclusion:

- Huawei Health has a real live connection to the watch on this phone.
- PERFORM can already inspect Android/Bluetooth readiness.
- Official Huawei Health Kit reading is still blocked by missing
  `agconnect-services.json`.
- Missing `com.huawei.hwid` should be logged as context, but not treated as a
  hard blocker because Huawei Health itself exposes active health/device
  services on this device.

## Health Connect Fallback 2026-06-04

Until `agconnect-services.json` is available, PERFORM can still test Huawei
coverage through Android Health Connect.

Implementation state:

- `com.huawei.health` is now a supported Health Connect `DataOrigin` together
  with Xiaomi/Zepp sources.
- Health Connect daily summaries and workout reads accept Huawei-origin records
  instead of showing them only in the "all sources" diagnostic counters.
- The mobile diagnostics label now separates:
  - supported source found/not found;
  - Huawei Health found/not found;
  - supported-source counters vs all-source counters.

Important limitation:

- This is only a fallback. It proves whether Huawei Health writes usable data
  into Health Connect on this phone. It does not replace Huawei Health Kit and
  does not prove direct watch access.

## AppGallery Connect Status 2026-06-04

Safari login reached AppGallery Connect and opened project `MVP`.

Current blocker:

- The project has no Android app yet.
- The Add app form in the project services area defaults to Web/Harmony-style
  app creation and does not allow selecting Android.
- The Apps and atomic services section redirects to `Identity verification`.
- Therefore the account must complete Huawei identity verification before
  `com.perform.training` can be registered as an Android app.

After verification:

1. Create Android app `PERFORM` with package `com.perform.training`.
2. Add the current debug SHA-1/SHA-256 fingerprints from
   `docs/huawei-health-setup.md`.
3. Enable Health Kit and Account Kit.
4. Download `agconnect-services.json`.
5. Install it with `scripts/install-huawei-agconnect.sh`.
6. Rebuild Android and test Huawei Health Kit authorization.

## Second Android Probe 2026-06-12

Connected phone:

- Manufacturer/model: Xiaomi `2407FPN8EG`.
- PERFORM is installed: `com.perform.training` version `1.0.23`.
- HMS Core is installed: `com.huawei.hwid` version `6.15.6.332`.
- Huawei Health is installed: `com.huawei.health` version `16.1.4.310`.
- Huawei watch is connected through Huawei Health.
- `agconnect-services.json` is installed in the Android project.

Phone-side authorization:

- Huawei Health `Health Service Kit` is enabled in privacy settings.
- Huawei Health shows PERFORM under data sharing/authorization.
- The visible PERFORM permissions are enabled for distance/elevation, workouts,
  calories, sleep and heart rate.

Direct Huawei Health Kit result:

- `HuaweiHealth.isAvailable` returns available with AG Connect config, HMS Core
  and Huawei Health present.
- `HuaweiHealth.requestAuthorization` opens Huawei Health and returns without
  a local setup blocker.
- `HuaweiHealth.readDailySummary` fails with `50005`.
- Logcat shows the Health Kit SDK querying the Huawei cloud app profile and
  receiving `appInfo is null` before reporting an unknown authorization error.

AppGallery Connect result:

- Android app `PERFORM` / `com.perform.training` exists under project `MVP`, but
  its app release status is `Draft`.
- Project settings for app `PERFORM` show `Account Kit` enabled under `Manage
  APIs`.
- `Health Kit` / `Health Service Kit` is not present in the available `Manage
  APIs` list for this app/account.
- The Huawei developer account menu shows `Not verified`.

Health Connect fallback result:

- Health Connect is installed and PERFORM can query it.
- Huawei Health is detected as an installed known source.
- No Huawei-origin sleep, heart-rate, exercise, distance or calorie records are
  exposed through Health Connect on this phone yet.

Conclusion:

- Local setup is complete enough for PERFORM development and diagnostics.
- Huawei watch pairing, HMS Core, Huawei Health, AG Connect config and local
  Huawei Health permissions are not the current blocker.
- Real Huawei Health Kit data reads remain blocked by the AppGallery Connect
  Health Kit service release/approval/cloud profile for `com.perform.training`.
