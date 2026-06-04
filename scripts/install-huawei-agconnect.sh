#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_PACKAGE="com.perform.training"
TARGET_FILE="$ROOT_DIR/apps/mobile/android/app/agconnect-services.json"

SOURCE_FILE="${1:-}"

if [[ -z "$SOURCE_FILE" ]]; then
  for candidate in \
    "$HOME/Downloads/agconnect-services.json" \
    "$ROOT_DIR/agconnect-services.json" \
    "$ROOT_DIR/apps/mobile/android/app/agconnect-services.json"; do
    if [[ -f "$candidate" ]]; then
      SOURCE_FILE="$candidate"
      break
    fi
  done
fi

if [[ -z "$SOURCE_FILE" || ! -f "$SOURCE_FILE" ]]; then
  echo "Usage: scripts/install-huawei-agconnect.sh /path/to/agconnect-services.json"
  echo
  echo "Expected package: $EXPECTED_PACKAGE"
  echo "Target: apps/mobile/android/app/agconnect-services.json"
  exit 1
fi

node --input-type=module - "$SOURCE_FILE" "$EXPECTED_PACKAGE" <<'NODE'
import fs from "node:fs";

const [, , sourceFile, expectedPackage] = process.argv;
const raw = fs.readFileSync(sourceFile, "utf8");
let parsed;

try {
  parsed = JSON.parse(raw);
} catch (error) {
  console.error(`Invalid JSON: ${error.message}`);
  process.exit(1);
}

const values = [];
const visit = (value, key = "") => {
  if (typeof value === "string") {
    values.push({ key, value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visit(entry, `${key}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([childKey, childValue]) => visit(childValue, key ? `${key}.${childKey}` : childKey));
  }
};

visit(parsed);

const packageHit = values.some(({ key, value }) => {
  const normalizedKey = key.toLowerCase();
  return value === expectedPackage && (normalizedKey.includes("package") || normalizedKey.includes("client"));
});

if (!packageHit) {
  console.error(`agconnect-services.json does not appear to target ${expectedPackage}.`);
  console.error("Refusing to install it into the Android app.");
  process.exit(1);
}
NODE

install -m 600 "$SOURCE_FILE" "$TARGET_FILE"

echo "OK  Installed apps/mobile/android/app/agconnect-services.json"
echo "    Package: $EXPECTED_PACKAGE"
echo
"$ROOT_DIR/scripts/check-huawei-watch-readiness.sh"
