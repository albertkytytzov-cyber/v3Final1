import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const pluginPath = join(rootDir, "apps", "mobile", "android", "app", "src", "main", "java", "com", "perform", "training", "DirectWatchPlugin.kt");
const coverageDocPath = join(rootDir, "docs", "perform-sync-gadgetbridge-adapter-plan.md");

const plugin = readFileSync(pluginPath, "utf8");
const coverageDoc = readFileSync(coverageDocPath, "utf8");

const requiredPluginPatterns = [
  ["daily details parser", /private fun parseClassicDailyDetails\(/u],
  ["daily summary parser", /private fun parseClassicDailySummary\(/u],
  ["manual samples parser", /private fun parseClassicManualSamples\(/u],
  ["sleep details parser", /private fun parseClassicSleepDetails\(/u],
  ["sleep stages parser", /private fun parseClassicSleepStages\(/u],
  ["workout summary dispatcher", /private fun parseClassicKnownWorkoutSummary\(/u],
  ["workout details parser", /private fun parseClassicWorkoutDetails\(/u],
  ["workout GPS parser", /private fun parseClassicWorkoutGps\(/u],
  ["daily details v1-v4", /val headerSize = when \(file\.version\) \{\s+1, 2 -> 4\s+3 -> 5\s+4 -> 6/u],
  ["manual samples v2", /file\.version != 2/u],
  ["sleep details v1-v5", /file\.type != 0 \|\| file\.subtype != 8 \|\| file\.version > 5/u],
  ["outdoor running/walking v1 summary", /1, 2 -> parseClassicOutdoorWalkingV1Summary/u],
  ["treadmill summary", /3 -> parseClassicTreadmillSummary/u],
  ["outdoor cycling summary", /6 -> parseClassicOutdoorCyclingSummary/u],
  ["indoor cycling summary", /7 -> parseClassicIndoorCyclingSummary/u],
  ["freestyle summary", /8 -> parseClassicFreestyleSummary/u],
  ["pool swimming summary", /9 -> parseClassicPoolSwimmingSummary/u],
  ["elliptical summary", /11 -> parseClassicEllipticalSummary/u],
  ["rowing summary", /13 -> parseClassicRowingSummary/u],
  ["jump rope summary", /14 -> parseClassicJumpRopingSummary/u],
  ["HIIT summary", /16 -> parseClassicHiitSummary/u],
  ["outdoor walking v2 summary", /22 -> parseClassicOutdoorWalkingV2Summary/u],
  ["outdoor cycling v2 summary", /23 -> parseClassicOutdoorCyclingV2Summary/u],
];

const requiredDocFragments = [
  "Parser coverage audit, 27.05.2026",
  "ACTIVITY_DAILY",
  "ACTIVITY_SLEEP",
  "ACTIVITY_MANUAL_SAMPLES",
  "SPORTS",
  "parseClassicWorkoutDetails",
  "экспериментально",
  "CLASSIC_ACTIVITY_FILE_PROBE_LIMIT = 512",
];

function fail(message) {
  console.error(`DirectWatch parser coverage check failed: ${message}`);
  process.exitCode = 1;
}

for (const [label, pattern] of requiredPluginPatterns) {
  if (!pattern.test(plugin)) {
    fail(`missing ${label} in DirectWatchPlugin.kt`);
  }
}

for (const fragment of requiredDocFragments) {
  if (!coverageDoc.includes(fragment)) {
    fail(`coverage document missing "${fragment}"`);
  }
}

if (!process.exitCode) {
  console.log("DirectWatch parser coverage check passed: daily, sleep, manual, workout summary, GPS and experimental details are documented and guarded.");
}
