import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const mobileAppPath = join(rootDir, "apps", "mobile", "src", "screens", "app.ts");
const backgroundPlanPath = join(rootDir, "docs", "perform-sync-background-sync-plan.md");

const mobileApp = readFileSync(mobileAppPath, "utf8");
const backgroundPlan = readFileSync(backgroundPlanPath, "utf8");

const requiredMobilePatterns = [
  ["render point limit", /const DEVICE_WORKOUT_SERIES_RENDER_LIMIT = 1_600;/u],
  ["history group cache", /const watchWorkoutHistoryGroupsCache = new WeakMap<DeviceWorkout\[\], Map<string, WatchWorkoutHistoryGroup\[\]>>\(\);/u],
  ["graph summary cache", /const deviceWorkoutGraphSummaryCache = new WeakMap<DeviceWorkout, boolean>\(\);/u],
  ["graph series cache", /const deviceWorkoutGraphSeriesCache = new WeakMap<DeviceWorkout, Map<string, DeviceWorkoutGraphSeries\[\]>>\(\);/u],
  ["heart-rate detail html cache", /const deviceWorkoutHeartRateDetailHtmlCache = new WeakMap<DeviceWorkout, Map<string, string>>\(\);/u],
  ["time parse cache", /const deviceWorkoutGraphTimeCache = new Map<string, number \| null>\(\);/u],
  ["display key cache", /const deviceWorkoutDisplayKeyCache = new WeakMap<DeviceWorkout, string>\(\);/u],
  ["completeness score cache", /const deviceWorkoutCompletenessScoreCache = new WeakMap<DeviceWorkout, number>\(\);/u],
  ["history period cache key", /const cacheKey = `\$\{athleteId\}\|\$\{date\}\|\$\{period\}`;/u],
  ["history source WeakMap lookup", /watchWorkoutHistoryGroupsCache\.get\(sourceWorkouts\)/u],
  ["graph series cache key", /getDeviceWorkoutGraphSeriesCacheKey\(workout, context\)/u],
  ["graph series cache eviction", /if \(nextWorkoutCache\.size >= 6\)/u],
  ["detail html cache key", /getDeviceWorkoutSeriesCacheKey\(series, workout\)/u],
  ["detail html cache eviction", /deviceWorkoutHeartRateDetailHtmlCache\.set\(workout, nextWorkoutCache\)/u],
  ["quick graph summary scan", /const quickSampleLimit = Math\.min\(workout\.samples\.length, 48\);/u],
  ["detail graph visible point limit", /const visiblePoints = limitDeviceWorkoutSamples\(points, 260\);/u],
  ["graph samples compaction", /return limitDeviceWorkoutSamples\(samples, DEVICE_WORKOUT_SERIES_RENDER_LIMIT\);/u],
  ["uPlot payload store", /const mobileUPlotPayloads = new Map<string, MobileUPlotPayload>\(\);/u],
  ["uPlot mount", /function mountMobileUPlotCharts\(root: HTMLElement\): UPlotInstance\[\]/u],
  ["uPlot destroy on rerender", /mountedUPlotCharts\.forEach\(\(chart\) => chart\.destroy\(\)\);/u],
];

const requiredDocFragments = [
  "Performance guard audit, 27.05.2026",
  "history groups are cached",
  "graph series are cached",
  "detail heart-rate HTML is cached",
  "heavy render paths are capped",
  "No UI layout changes were made",
];

function fail(message) {
  console.error(`Mobile workout performance guard check failed: ${message}`);
  process.exitCode = 1;
}

for (const [label, pattern] of requiredMobilePatterns) {
  if (!pattern.test(mobileApp)) {
    fail(`missing ${label} in mobile workout rendering`);
  }
}

for (const fragment of requiredDocFragments) {
  if (!backgroundPlan.includes(fragment)) {
    fail(`background sync plan missing "${fragment}"`);
  }
}

if (!process.exitCode) {
  console.log("Mobile workout performance guard check passed: workout history, graph series, detail HTML and uPlot rendering stay cached and capped.");
}
