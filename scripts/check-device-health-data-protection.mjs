import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const apiServicePath = join(rootDir, "apps", "api", "src", "services", "device-health.service.ts");
const mobileAppPath = join(rootDir, "apps", "mobile", "src", "screens", "app.ts");
const directWatchPath = join(rootDir, "apps", "mobile", "src", "integrations", "direct-watch.ts");
const deviceHealthService = await import("../apps/api/src/services/device-health.service.ts");
const {
  mergeDeviceHealthRawPayload,
  normalizeSleepSummary,
} = deviceHealthService.default ?? deviceHealthService;

const apiService = readFileSync(apiServicePath, "utf8");
const mobileApp = readFileSync(mobileAppPath, "utf8");
const directWatch = readFileSync(directWatchPath, "utf8");

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

check("sleep normalization keeps the most complete duration", () => {
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

  assert.equal(normalized.durationMinutes, 415);
});

check("API SQL protects existing sleep and workout totals", () => {
  assert.match(
    apiService,
    /sleep_duration_minutes = CASE WHEN \$31 THEN COALESCE\(GREATEST\(device_health_daily_summaries\.sleep_duration_minutes, EXCLUDED\.sleep_duration_minutes\)/u,
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
  assert.match(mobileApp, /serviceStatus\s+\?\s+serviceStatus\.running === true\s+:\s+Boolean\(result\.keptBluetoothBridge && isFutureDate\(result\.bridgeUntil\)\)/u);
  assert.doesNotMatch(mobileApp, /lastServiceStatus: completedServiceResult\.keptBluetoothBridge \? "running" : "synced"/u);
});

check("DirectWatch raw files are ACKed only after a real server submit or queued flush", () => {
  assert.match(mobileApp, /const didQueueForServer = healthResult === "queued" \|\| workoutsResult === "queued";/u);
  assert.match(mobileApp, /if \(didQueueForServer && ackFileIds\.length > 0\) \{\s+markDirectWatchRawCacheQueued/u);
  assert.match(mobileApp, /entry\.status === "queued" && Boolean\(entry\.queuedAt\)/u);
  assert.match(directWatch, /queuedAt\?: string \| null;/u);
  assert.match(directWatch, /queuedAt: new Date\(\)\.toISOString\(\)/u);
});

if (!process.exitCode) {
  console.log("Device health data protection check passed: partial watch packets cannot downgrade steps, sleep, samples, SpO2, pulse or workout totals.");
}
