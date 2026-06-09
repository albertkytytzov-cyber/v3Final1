import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const expectedApiBaseUrl =
  process.env.PERFORM_PRODUCTION_API_BASE_URL ||
  "https://185.195.185.67.sslip.io/api/v1";

const configFiles = [
  {
    label: "mobile web",
    path: "apps/mobile/www/mobile-config.js",
    required: true,
  },
  {
    label: "iOS bundled app",
    path: "apps/mobile/ios/App/App/public/mobile-config.js",
    required: false,
  },
  {
    label: "Android bundled app",
    path: "apps/mobile/android/app/src/main/assets/public/mobile-config.js",
    required: false,
  },
];

const unsafeUrlPatterns = [
  /(^|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?)(:|\/|$)/i,
  /^http:\/\//i,
];

function extractApiBaseUrl(filePath) {
  const source = readFileSync(filePath, "utf8");
  const match = source.match(/"apiBaseUrl"\s*:\s*"([^"]+)"/);
  return match?.[1] ?? "";
}

const failures = [];
const warnings = [];

for (const configFile of configFiles) {
  const fullPath = resolve(repoRoot, configFile.path);

  if (!existsSync(fullPath)) {
    const message = `${configFile.label}: ${configFile.path} is missing`;
    if (configFile.required) {
      failures.push(message);
    } else {
      warnings.push(message);
    }
    continue;
  }

  const apiBaseUrl = extractApiBaseUrl(fullPath);

  if (!apiBaseUrl) {
    failures.push(`${configFile.label}: apiBaseUrl is empty or missing`);
    continue;
  }

  if (unsafeUrlPatterns.some((pattern) => pattern.test(apiBaseUrl))) {
    failures.push(`${configFile.label}: unsafe release URL ${apiBaseUrl}`);
    continue;
  }

  if (apiBaseUrl !== expectedApiBaseUrl) {
    failures.push(
      `${configFile.label}: expected ${expectedApiBaseUrl}, got ${apiBaseUrl}`,
    );
    continue;
  }

  console.log(`${configFile.label}: ${apiBaseUrl}`);
}

for (const warning of warnings) {
  console.warn(`Warning: ${warning}`);
}

if (failures.length > 0) {
  console.error("Mobile release config check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Mobile release config check passed.");
