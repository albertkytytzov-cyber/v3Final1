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

Not the primary health-data path.

Wear Engine is useful for phone-watch message and file communication when both
sides have a compatible app/permission setup. It should not be treated as proof
that PERFORM can read Huawei health files directly from the band.

Use only if we decide to build a Huawei-specific watch-side or message-based
feature later.

## Unified PERFORM Provider Model

Add Huawei as a provider beside DirectWatch/Xiaomi:

| Provider | Owner of watch connection | PERFORM reads from | Main risk |
| --- | --- | --- | --- |
| `direct-xiaomi` | PERFORM native service | raw watch files | protocol changes, auth, CRC/parser coverage |
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
