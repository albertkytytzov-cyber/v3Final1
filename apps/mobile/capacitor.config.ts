import type { CapacitorConfig } from "@capacitor/cli";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadLocalMobileEnv() {
  const localEnvPath = resolve(__dirname, ".env.mobile.local");

  if (!existsSync(localEnvPath)) {
    return;
  }

  for (const line of readFileSync(localEnvPath, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#") || !trimmedLine.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmedLine.split("=");
    const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadLocalMobileEnv();

const mobileServerUrl = process.env.MOBILE_SERVER_URL?.replace(/\/+$/, "");

const config: CapacitorConfig = {
  appId: "com.perform.training",
  appName: "PERFORM",
  webDir: "www",
  ...(mobileServerUrl
    ? {
        server: {
          url: mobileServerUrl,
          cleartext: mobileServerUrl.startsWith("http://"),
        },
      }
    : {}),
};

export default config;
