import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const localEnvPath = resolve(appRoot, ".env.mobile.local");

function loadLocalEnv() {
  if (!existsSync(localEnvPath)) {
    return {};
  }

  return readFileSync(localEnvPath, "utf8")
    .split(/\r?\n/)
    .reduce((values, line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#") || !trimmedLine.includes("=")) {
        return values;
      }

      const [key, ...valueParts] = trimmedLine.split("=");
      values[key.trim()] = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
      return values;
    }, {});
}

function toApiBaseUrl(value) {
  const trimmedValue = value?.trim().replace(/\/+$/, "");

  if (!trimmedValue) {
    return "";
  }

  return trimmedValue.endsWith("/api/v1")
    ? trimmedValue
    : `${trimmedValue}/api/v1`;
}

const localEnv = loadLocalEnv();
const apiBaseUrl = toApiBaseUrl(
  process.env.MOBILE_API_BASE_URL ||
    localEnv.MOBILE_API_BASE_URL ||
    process.env.MOBILE_SERVER_URL ||
    localEnv.MOBILE_SERVER_URL ||
    "",
);

const config = `window.__PERFORM_MOBILE_CONFIG__ = ${JSON.stringify(
  { apiBaseUrl },
  null,
  2,
)};\n`;

writeFileSync(resolve(appRoot, "www", "mobile-config.js"), config, "utf8");
