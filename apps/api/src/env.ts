import { existsSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "../../..");

for (const envPath of [resolve(repoRoot, ".env.local"), resolve(repoRoot, ".env")]) {
  if (!existsSync(envPath)) {
    continue;
  }

  try {
    process.loadEnvFile(envPath);
  } catch {
    // Ignore malformed or already-loaded files here; bootstrap surfaces actionable errors later.
  }
}
