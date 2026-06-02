import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const apiServicePath = join(rootDir, "apps", "api", "src", "services", "device-health.service.ts");
const mobileAppPath = join(rootDir, "apps", "mobile", "src", "screens", "app.ts");
const directWatchPath = join(rootDir, "apps", "mobile", "src", "integrations", "direct-watch.ts");
const androidDirectWatchPluginPath = join(
  rootDir,
  "apps",
  "mobile",
  "android",
  "app",
  "src",
  "main",
  "java",
  "com",
  "perform",
  "training",
  "DirectWatchPlugin.kt",
);
const androidForegroundServicePath = join(
  rootDir,
  "apps",
  "mobile",
  "android",
  "app",
  "src",
  "main",
  "java",
  "com",
  "perform",
  "training",
  "DirectWatchForegroundService.kt",
);
const androidBluetoothSyncLockPath = join(
  rootDir,
  "apps",
  "mobile",
  "android",
  "app",
  "src",
  "main",
  "java",
  "com",
  "perform",
  "training",
  "DirectWatchBluetoothSyncLock.kt",
);
const gadgetbridgeSleepDetailsParserPath = join(
  rootDir,
  "_external",
  "Gadgetbridge",
  "app",
  "src",
  "main",
  "java",
  "nodomain",
  "freeyourgadget",
  "gadgetbridge",
  "service",
  "devices",
  "xiaomi",
  "activity",
  "impl",
  "SleepDetailsParser.java",
);
const gadgetbridgeSleepStagesParserPath = join(
  rootDir,
  "_external",
  "Gadgetbridge",
  "app",
  "src",
  "main",
  "java",
  "nodomain",
  "freeyourgadget",
  "gadgetbridge",
  "service",
  "devices",
  "xiaomi",
  "activity",
  "impl",
  "SleepStagesParser.java",
);
const deviceHealthService = await import("../apps/api/src/services/device-health.service.ts");
const {
  mergeDeviceHealthRawPayload,
  normalizeSleepSummary,
} = deviceHealthService.default ?? deviceHealthService;

const apiService = readFileSync(apiServicePath, "utf8");
const mobileApp = readFileSync(mobileAppPath, "utf8");
const directWatch = readFileSync(directWatchPath, "utf8");
const androidDirectWatchPlugin = readFileSync(androidDirectWatchPluginPath, "utf8");
const androidForegroundService = readFileSync(androidForegroundServicePath, "utf8");
const androidBluetoothSyncLock = readFileSync(androidBluetoothSyncLockPath, "utf8");
const gadgetbridgeSleepDetailsParser = readFileSync(gadgetbridgeSleepDetailsParserPath, "utf8");
const gadgetbridgeSleepStagesParser = readFileSync(gadgetbridgeSleepStagesParserPath, "utf8");

function fail(message) {
  console.error(`Device health data protection check failed: ${message}`);
  process.exitCode = 1;
}

function check(name, assertion) {
  try {
    assertion();
  } catch (error) {
    fail(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

check("partial minute details do not overwrite existing steps", () => {
  const merged = mergeDeviceHealthRawPayload(
    {
      calories: 620,
      stepCount: 10_500,
      steps: 10_450,
      stepsSource: "daily-summary",
      totalSteps: 10_520,
      trainingLoadDay: 42,
      trainingLoadWeek: 190,
      vitality: 75,
    },
    {
      calories: 120,
      minuteSteps: 430,
      stepCount: 430,
      steps: 430,
      stepsSource: "minute-details-partial",
      totalSteps: 430,
      trainingLoadDay: 8,
      trainingLoadWeek: 25,
      vitality: 12,
    },
  );

  assert.equal(merged.steps, 10_520);
  assert.equal(merged.stepCount, 10_520);
  assert.equal(merged.totalSteps, 10_520);
  assert.equal(merged.stepsSource, "daily-summary");
  assert.equal(merged.calories, 620);
  assert.equal(merged.trainingLoadDay, 42);
  assert.equal(merged.trainingLoadWeek, 190);
  assert.equal(merged.vitality, 75);
});

check("partial minute details without existing total remove fake steps", () => {
  const merged = mergeDeviceHealthRawPayload(null, {
    minuteSteps: 430,
    stepCount: 430,
    steps: 430,
    stepsSource: "minute-details-partial",
    totalSteps: 430,
  });

  assert.equal(merged.steps, undefined);
  assert.equal(merged.stepCount, undefined);
  assert.equal(merged.totalSteps, undefined);
});

check("daily summary can raise steps but cannot lower them", () => {
  const lower = mergeDeviceHealthRawPayload(
    { steps: 9_000, stepsSource: "daily-summary" },
    { steps: 3_000, stepsSource: "daily-summary" },
  );
  const higher = mergeDeviceHealthRawPayload(
    { steps: 9_000, stepsSource: "daily-summary" },
    { steps: 11_000, stepsSource: "daily-summary" },
  );

  assert.equal(lower.steps, 9_000);
  assert.equal(lower.stepsSource, "daily-summary");
  assert.equal(higher.steps, 11_000);
});

check("sleep normalization keeps the most complete sleep duration without awake time", () => {
  const normalized = normalizeSleepSummary({
    awakeMinutes: 12,
    deepMinutes: 114,
    durationMinutes: 35,
    endTime: "2026-05-27T05:45:00.000Z",
    lightMinutes: 205,
    remMinutes: 84,
    score: 78,
    startTime: "2026-05-26T23:30:00.000Z",
  });

  assert.equal(normalized.durationMinutes, 403);
});

check("sleep normalization does not inflate sleep from a broad in-bed window", () => {
  const normalized = normalizeSleepSummary({
    awakeMinutes: 8,
    deepMinutes: 104,
    durationMinutes: 392,
    endTime: "2026-06-01T08:30:00.000Z",
    lightMinutes: 188,
    remMinutes: 92,
    score: 81,
    startTime: "2026-05-31T20:30:00.000Z",
  });

  assert.equal(normalized.durationMinutes, 384);
});

check("sleep normalization corrects duration that accidentally includes awake time", () => {
  const normalized = normalizeSleepSummary({
    awakeMinutes: 120,
    deepMinutes: null,
    durationMinutes: 484,
    endTime: "2026-06-01T05:01:00.000Z",
    lightMinutes: 364,
    remMinutes: null,
    score: null,
    startTime: "2026-05-31T20:57:00.000Z",
  });

  assert.equal(normalized.durationMinutes, 364);
});

check("sleep stage totals exclude awake time in every storage layer", () => {
  assert.match(apiService, /const values = \[\s+sleep\.deepMinutes,\s+sleep\.lightMinutes,\s+sleep\.remMinutes,\s+\]/u);
  assert.doesNotMatch(apiService, /const values = \[\s+sleep\.awakeMinutes,\s+sleep\.deepMinutes/u);

  assert.match(directWatch, /const stages = \[\s+value\.deepMinutes,\s+value\.lightMinutes,\s+value\.remMinutes,\s+\]/u);
  assert.doesNotMatch(directWatch, /const stages = \[\s+value\.awakeMinutes,\s+value\.deepMinutes/u);

  assert.match(mobileApp, /const values = \[\s+sleep\.deepMinutes,\s+sleep\.lightMinutes,\s+sleep\.remMinutes,\s+\]/u);
  assert.doesNotMatch(mobileApp, /const values = \[\s+sleep\.awakeMinutes,\s+sleep\.deepMinutes/u);
});

check("sleep merge preserves existing stage detail when incoming watch packet is partial", () => {
  assert.match(mobileApp, /function mergeSleepStageValue\(/u);
  assert.match(mobileApp, /return incoming \?\? existing \?\? null;/u);
  assert.match(apiService, /deep_sleep_minutes = CASE WHEN \$31 THEN COALESCE\(EXCLUDED\.deep_sleep_minutes, device_health_daily_summaries\.deep_sleep_minutes\)/u);
  assert.match(apiService, /rem_sleep_minutes = CASE WHEN \$31 THEN COALESCE\(EXCLUDED\.rem_sleep_minutes, device_health_daily_summaries\.rem_sleep_minutes\)/u);
});

check("API SQL protects existing sleep and workout totals", () => {
  assert.match(
    apiService,
    /sleep_duration_minutes = CASE WHEN \$31 THEN\s+CASE[\s\S]+device_health_daily_summaries\.sleep_start_time = EXCLUDED\.sleep_start_time[\s\S]+THEN EXCLUDED\.sleep_duration_minutes[\s\S]+GREATEST\(device_health_daily_summaries\.sleep_duration_minutes, EXCLUDED\.sleep_duration_minutes\)/u,
  );
  assert.match(apiService, /min_hr = CASE WHEN \$32 THEN COALESCE\(LEAST/u);
  assert.match(apiService, /max_hr = CASE WHEN \$32 THEN COALESCE\(GREATEST/u);
  assert.match(apiService, /oxygen_saturation_sample_count = CASE WHEN \$33 THEN GREATEST/u);
  assert.match(apiService, /workout_count = CASE WHEN \$34 THEN GREATEST/u);
  assert.match(apiService, /workout_duration_minutes = CASE WHEN \$34 THEN COALESCE\(GREATEST/u);
  assert.match(apiService, /workout_distance_meters = CASE WHEN \$34 THEN COALESCE\(GREATEST/u);
  assert.match(apiService, /workout_active_calories = CASE WHEN \$34 THEN COALESCE\(GREATEST/u);
});

check("sample replacement requires incoming sample count to be at least existing count", () => {
  assert.match(
    apiService,
    /metricsToReplace = metrics\.filter\(\(metric\) =>\s+\(incomingCountsByMetric\.get\(metric\) \?\? 0\) >= \(existingCountsByMetric\.get\(metric\) \?\? 0\)/u,
  );
  assert.match(
    mobileApp,
    /const shouldReplaceMetric = samples\.length >= existingItems\.length;/u,
  );
});

check("DirectWatch marks partial minute steps separately from daily totals", () => {
  assert.match(directWatch, /stepsSource:[\s\S]+daily-summary[\s\S]+minute-details-partial/u);
  assert.match(mobileApp, /incomingSource === "minute-details-partial"/u);
});

check("mobile workout list keeps the more complete duplicate", () => {
  assert.match(mobileApp, /getDeviceWorkoutCompletenessScore\(workout\) > getDeviceWorkoutCompletenessScore\(previous\)/u);
});

check("mobile service status trusts native status over bridge hint", () => {
  assert.match(mobileApp, /const getSettledDirectWatchSyncServiceStatus = async \(\) =>/u);
  assert.match(mobileApp, /DIRECT_WATCH_SERVICE_STATUS_SETTLE_MS/u);
  assert.match(mobileApp, /window\.setTimeout\(\(\) => \{\s+void refreshDirectWatchSyncService\(\)\.catch\(\(\) => undefined\);\s+\}, DIRECT_WATCH_SERVICE_STATUS_SETTLE_MS\);/u);
  assert.match(mobileApp, /serviceStatus\s+\?\s+serviceStatus\.running === true\s+:\s+Boolean\(serviceResult\?\.keptBluetoothBridge && isFutureDate\(serviceResult\.bridgeUntil\)\)/u);
  assert.doesNotMatch(mobileApp, /lastServiceStatus: completedServiceResult\.keptBluetoothBridge \? "running" : "synced"/u);
});

check("DirectWatch raw files are ACKed only after a real server submit or queued flush", () => {
  assert.match(mobileApp, /const didQueueForServer = healthResult === "queued" \|\| workoutsResult === "queued";/u);
  assert.match(mobileApp, /if \(didQueueForServer && ackFileIds\.length > 0\) \{\s+markDirectWatchRawCacheQueued/u);
  assert.match(mobileApp, /entry\.status === "queued" && Boolean\(entry\.queuedAt\)/u);
  assert.match(directWatch, /queuedAt\?: string \| null;/u);
  assert.match(directWatch, /queuedAt: new Date\(\)\.toISOString\(\)/u);
});

check("DirectWatch service sync serializes Bluetooth access", () => {
  assert.match(mobileApp, /let directWatchServiceSyncInFlight = false;/u);
  assert.match(mobileApp, /directWatchNativeSyncInFlight \|\|\s+directWatchServiceSyncInFlight/u);
  assert.match(mobileApp, /if \(directWatchServiceSyncInFlight\) \{\s+if \(!options\.silent\)/u);
  assert.match(mobileApp, /directWatchServiceSyncInFlight = true;/u);
  assert.match(mobileApp, /finally \{\s+directWatchServiceSyncInFlight = false;/u);
  assert.match(androidBluetoothSyncLock, /object DirectWatchBluetoothSyncLock/u);
  assert.match(androidBluetoothSyncLock, /fun tryAcquire\(nextOwner: String\): Boolean/u);
  assert.match(androidDirectWatchPlugin, /DirectWatchBluetoothSyncLock\.tryAcquire\(bluetoothSyncOwner\)/u);
  assert.match(androidDirectWatchPlugin, /DirectWatchBluetoothSyncLock\.release\(bluetoothSyncOwner\)/u);
  assert.match(androidForegroundService, /if \(DirectWatchBluetoothSyncLock\.isBusy\(\)\)/u);
  assert.match(androidForegroundService, /Фоновая синхронизация часов ждёт текущий Bluetooth-обмен PERFORM Sync/u);
});

check("DirectWatch weather refresh does not reuse stale overnight forecast", () => {
  assert.match(androidDirectWatchPlugin, /CLASSIC_WEATHER_PAYLOAD_MAX_AGE_MS = 30 \* 60 \* 1000L/u);
  assert.match(androidDirectWatchPlugin, /isClassicWeatherPayloadFresh\(locatedPayload\)/u);
  assert.match(androidDirectWatchPlugin, /classic weather payload is stale; fetching fresh forecast/u);
  assert.match(androidDirectWatchPlugin, /parseWeatherPublicationTimestampMs/u);
  assert.doesNotMatch(
    androidDirectWatchPlugin,
    /if \(hasForecast && !locationResolution\.changed\) \{\s+return locatedPayload/u,
  );
});

check("DirectWatch native activity refresh requests history when sleep is needed", () => {
  assert.match(androidDirectWatchPlugin, /val includeHistory = includeSleep/u);
  assert.match(androidDirectWatchPlugin, /buildClassicPostAuthProbeCommands\(includeHistory = includeHistory\)/u);
  assert.match(androidDirectWatchPlugin, /durationMs = CLASSIC_POST_AUTH_HISTORY_READ_MS/u);
  assert.match(directWatch, /DIRECT_WATCH_SLEEP_MIN_MEANINGFUL_MINUTES = 120/u);
  assert.match(directWatch, /duration !== null && duration >= DIRECT_WATCH_SLEEP_MIN_MEANINGFUL_MINUTES/u);
});

check("DirectWatch native sleep parser only applies plausible type 17 stage timelines", () => {
  assert.match(gadgetbridgeSleepDetailsParser, /else if \(type == 16\)/u);
  assert.match(gadgetbridgeSleepDetailsParser, /sample\.setTotalDuration\(sleep_duration\)/u);
  assert.match(gadgetbridgeSleepDetailsParser, /sample\.setDeepSleepDuration\(deep_duration\)/u);
  assert.match(gadgetbridgeSleepDetailsParser, /sample\.setLightSleepDuration\(light_duration\)/u);
  assert.match(gadgetbridgeSleepDetailsParser, /sample\.setRemSleepDuration\(rem_duration\)/u);
  assert.match(gadgetbridgeSleepDetailsParser, /sample\.setAwakeDuration\(wake_duration\)/u);
  assert.match(gadgetbridgeSleepDetailsParser, /else if \(type == 17\)/u);
  assert.match(gadgetbridgeSleepDetailsParser, /final int stage = val >> 12;/u);
  assert.match(gadgetbridgeSleepDetailsParser, /final int offsetMinutes = val & 0xFFF;/u);
  assert.match(gadgetbridgeSleepDetailsParser, /stageSample\.setTimestamp\(currentTime\)/u);
  assert.match(gadgetbridgeSleepDetailsParser, /currentTime \+= offsetMinutes \* 60000;/u);

  assert.match(androidDirectWatchPlugin, /packetType == 17/u);
  assert.match(androidDirectWatchPlugin, /val stage = encoded ushr 12/u);
  assert.match(androidDirectWatchPlugin, /val offsetMinutes = encoded and 0x0fff/u);
  assert.match(androidDirectWatchPlugin, /sleepStageSamples\.add\(currentTimestampMs to stage\)/u);
  assert.match(androidDirectWatchPlugin, /2 -> stageDeepMinutes \+= intervalMinutes/u);
  assert.match(androidDirectWatchPlugin, /3 -> stageRemMinutes \+= intervalMinutes/u);
  assert.match(androidDirectWatchPlugin, /val hasUsefulDetails = stageDeepMinutes > 0 \|\| stageRemMinutes > 0/u);
  assert.match(androidDirectWatchPlugin, /sleepStageMinutes <= windowMinutes/u);
  assert.match(androidDirectWatchPlugin, /classic sleep stage totals ignored/u);
  assert.match(androidDirectWatchPlugin, /classic sleep stage totals/u);
});

check("DirectWatch native sleep parser keeps Gadgetbridge type 16 and subtype 3 field layout", () => {
  assert.match(androidDirectWatchPlugin, /durationMinutes = bigEndianUInt16\(bytes, dataOffset \+ 1\)/u);
  assert.match(androidDirectWatchPlugin, /awakeMinutes = bigEndianUInt16\(bytes, dataOffset \+ 3\)/u);
  assert.match(androidDirectWatchPlugin, /lightMinutes = bigEndianUInt16\(bytes, dataOffset \+ 5\)/u);
  assert.match(androidDirectWatchPlugin, /remMinutes = bigEndianUInt16\(bytes, dataOffset \+ 7\)/u);
  assert.match(androidDirectWatchPlugin, /deepMinutes = bigEndianUInt16\(bytes, dataOffset \+ 9\)/u);
  assert.match(gadgetbridgeSleepStagesParser, /final short sleepDuration = buf\.getShort\(\);/u);
  assert.match(gadgetbridgeSleepStagesParser, /final short deepSleepDuration = buf\.getShort\(\);/u);
  assert.match(gadgetbridgeSleepStagesParser, /final short lightSleepDuration = buf\.getShort\(\);/u);
  assert.match(gadgetbridgeSleepStagesParser, /final short REMDuration = buf\.getShort\(\);/u);
  assert.match(gadgetbridgeSleepStagesParser, /final short wakeDuration = buf\.getShort\(\);/u);
  assert.match(androidDirectWatchPlugin, /val duration = takeShort\(\)\?\.takeIf \{ it > 0 \}/u);
  assert.match(androidDirectWatchPlugin, /val deep = takeShort\(\)\?\.takeIf \{ it > 0 \}/u);
  assert.match(androidDirectWatchPlugin, /val light = takeShort\(\)\?\.takeIf \{ it > 0 \}/u);
  assert.match(androidDirectWatchPlugin, /val rem = takeShort\(\)\?\.takeIf \{ it > 0 \}/u);
  assert.match(androidDirectWatchPlugin, /val awake = takeShort\(\)\?\.takeIf \{ it > 0 \}/u);
});

check("DirectWatch file assembly keeps later successful retry after CRC failures", () => {
  assert.match(androidDirectWatchPlugin, /file\?\.crcValid == true && !seenCompleteActivityFiles\.add/u);
  assert.doesNotMatch(
    androidDirectWatchPlugin,
    /file\?\.crcValid != null && !seenCompleteActivityFiles\.add/u,
  );
});

if (!process.exitCode) {
  console.log("Device health data protection check passed: partial watch packets cannot downgrade steps, sleep, samples, SpO2, pulse or workout totals.");
}
