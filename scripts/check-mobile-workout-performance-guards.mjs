import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const mobileApiClientPath = join(rootDir, "apps", "mobile", "src", "api", "client.ts");
const mobileAppPath = join(rootDir, "apps", "mobile", "src", "screens", "app.ts");
const mobileLocalStorePath = join(rootDir, "apps", "mobile", "src", "storage", "local-store.ts");
const backgroundPlanPath = join(rootDir, "docs", "perform-sync-background-sync-plan.md");

const mobileApiClient = readFileSync(mobileApiClientPath, "utf8");
const mobileApp = readFileSync(mobileAppPath, "utf8");
const mobileLocalStore = readFileSync(mobileLocalStorePath, "utf8");
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
  ["coach workout detail state", /coachDeviceWorkoutDetailId: null/u],
  ["coach workout detail button", /data-coach-device-workout-detail="\$\{escapeHtml\(linkedWorkout\.id\)\}"/u],
  ["coach workout detail renderer", /function renderCoachDeviceWorkoutDetailScreen\(/u],
  ["coach linked workout runtime compaction", /function compactDeviceWorkoutLinkForRuntime\(/u],
  ["workout heart-rate outlier filter", /function isPlausibleWorkoutHeartRateBpm\(value: number\)/u],
  ["workout heart-rate summary bounds", /function isWorkoutHeartRateGraphValue\(workout: DeviceWorkout, value: number\)/u],
];

const requiredClientPatterns = [
  ["coach athlete-scoped data load", /function resolveCoachDataAthleteIds\(/u],
  ["coach selected athlete parameter", /selectedCoachAthleteId\?: string \| null/u],
  ["coach workout summaries without samples", /device-workouts\?includeSamples=false/u],
  ["coach workout detail samples endpoint", /listCoachDeviceWorkouts\(athleteId: string, entryDate: string, includeSamples = true\)/u],
  ["coach screens skip raw health samples", /deviceHealthSamples: userRole === "coach" \|\| userRole === "admin"[\s\S]*\? \[\][\s\S]*: deviceHealthSamples\.samples/u],
];

const requiredLocalStorePatterns = [
  ["snapshot storage compacts before first write", /const compactSnapshot = compactSnapshotForStorage\(snapshot\);[\s\S]*writeJson\(SNAPSHOT_KEY, compactSnapshot\);/u],
  ["linked workout storage compaction", /deviceWorkoutLinks: snapshot\.deviceWorkoutLinks\.map\(compactDeviceWorkoutLinkForStorage\)/u],
  ["linked workout raw payload stripping", /function compactDeviceWorkoutLinkForStorage[\s\S]*rawPayload: null,[\s\S]*samples: \[\],/u],
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

for (const [label, pattern] of requiredClientPatterns) {
  if (!pattern.test(mobileApiClient)) {
    fail(`missing ${label} in mobile API client`);
  }
}

for (const [label, pattern] of requiredLocalStorePatterns) {
  if (!pattern.test(mobileLocalStore)) {
    fail(`missing ${label} in mobile local storage`);
  }
}

const dataScreenHandlerStart = mobileApp.indexOf('root.querySelectorAll<HTMLButtonElement>("[data-screen]")');
const dataScreenHandlerEnd = mobileApp.indexOf('root.querySelectorAll<HTMLButtonElement>("[data-watch-detail]")', dataScreenHandlerStart);
if (dataScreenHandlerStart === -1 || dataScreenHandlerEnd === -1) {
  fail("missing mobile data-screen navigation handler");
} else if (mobileApp.slice(dataScreenHandlerStart, dataScreenHandlerEnd).includes("refreshData(true)")) {
  fail("mobile data-screen navigation must not trigger a data refresh");
}

const coachWorkoutPanelStart = mobileApp.indexOf("function renderCoachDeviceWorkoutPanel");
const coachWorkoutPanelEnd = mobileApp.indexOf("function renderCoachDeviceHealthSummaryCard", coachWorkoutPanelStart);
if (coachWorkoutPanelStart === -1 || coachWorkoutPanelEnd === -1) {
  fail("missing coach device workout panel");
} else if (mobileApp.slice(coachWorkoutPanelStart, coachWorkoutPanelEnd).includes("renderDeviceWorkoutGraph(linkedWorkout)")) {
  fail("coach execution overview must not render linked workout graphs inline");
}

const coachAthleteReadinessStart = mobileApp.indexOf("function renderCoachAthleteReadinessOverview");
const coachAthleteReadinessEnd = mobileApp.indexOf("function renderCoachAthleteSingleReadinessPoint", coachAthleteReadinessStart);
if (coachAthleteReadinessStart === -1 || coachAthleteReadinessEnd === -1) {
  fail("missing coach athlete readiness overview");
} else {
  const coachAthleteReadinessBlock = mobileApp.slice(coachAthleteReadinessStart, coachAthleteReadinessEnd);
  for (const duplicateLabel of ["Последняя готовность", "История готовности", "coach-athlete-latest-readiness-card", "coach-athlete-readiness-history"]) {
    if (coachAthleteReadinessBlock.includes(duplicateLabel)) {
      fail(`coach athlete readiness overview must not render duplicate block "${duplicateLabel}"`);
    }
  }
}

const coachAthleteDayBriefStart = mobileApp.indexOf("function renderCoachAthleteDayBrief");
const coachAthleteDayBriefEnd = mobileApp.indexOf("function renderCoachAthleteBriefMetric", coachAthleteDayBriefStart);
if (coachAthleteDayBriefStart === -1 || coachAthleteDayBriefEnd === -1) {
  fail("missing coach athlete day brief");
} else {
  const coachAthleteDayBriefBlock = mobileApp.slice(coachAthleteDayBriefStart, coachAthleteDayBriefEnd);
  if (coachAthleteDayBriefBlock.includes("Краткий статус дня")) {
    fail("coach athlete day brief must not duplicate readiness as a short status block");
  }

  if (/renderCoachAthleteBriefMetric\("Готовность"/u.test(coachAthleteDayBriefBlock)) {
    fail("coach athlete day brief must not repeat readiness metric already shown above");
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
