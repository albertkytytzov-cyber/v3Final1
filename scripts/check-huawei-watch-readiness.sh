#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGCONNECT_FILE="$ROOT_DIR/apps/mobile/android/app/agconnect-services.json"

echo "Huawei watch readiness"
echo "======================"

if [[ -s "$AGCONNECT_FILE" ]]; then
  echo "OK  agconnect-services.json found"
else
  echo "NO  agconnect-services.json missing"
  echo "    Expected: apps/mobile/android/app/agconnect-services.json"
  echo "    Huawei Health Kit authorization will not work in this build."
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "NO  adb not found"
  exit 0
fi

echo
echo "ADB devices"
adb devices -l

DEVICE_COUNT="$(adb devices | awk 'NR > 1 && $2 == "device" { count++ } END { print count + 0 }')"
if [[ "$DEVICE_COUNT" -eq 0 ]]; then
  echo
  echo "NO  Android device is not visible over adb"
  echo "    For Wi-Fi debugging, reconnect/pair the phone and re-run this script."
  exit 0
fi

ADB_TARGET="${ANDROID_SERIAL:-}"
if [[ -z "$ADB_TARGET" ]]; then
  ADB_TARGET="$(adb devices | awk 'NR > 1 && $2 == "device" && $1 ~ /:/ { print $1; exit }')"
fi
if [[ -z "$ADB_TARGET" ]]; then
  ADB_TARGET="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"
fi

ADB=(adb)
if [[ -n "$ADB_TARGET" ]]; then
  ADB=(adb -s "$ADB_TARGET")
fi

echo
echo "Using device: ${ADB_TARGET:-default}"

echo
echo "Huawei packages"
for package_name in com.huawei.hwid com.huawei.health; do
  if "${ADB[@]}" shell pm path "$package_name" >/dev/null 2>&1; then
    version="$("${ADB[@]}" shell dumpsys package "$package_name" 2>/dev/null | awk -F= '/versionName=/{ print $2; exit }' | tr -d '\r')"
    echo "OK  $package_name ${version:-installed}"
  elif [[ "$package_name" == "com.huawei.hwid" ]]; then
    echo "WARN $package_name missing"
    echo "     Huawei Health may still expose health/device services on non-Huawei phones."
  else
    echo "NO  $package_name missing"
  fi
done

echo
echo "PERFORM package"
if "${ADB[@]}" shell pm path com.perform.training >/dev/null 2>&1; then
  version="$("${ADB[@]}" shell dumpsys package com.perform.training 2>/dev/null | awk -F= '/versionName=/{ print $2; exit }' | tr -d '\r')"
  echo "OK  com.perform.training ${version:-installed}"
else
  echo "NO  com.perform.training is not installed"
fi

echo
echo "Huawei Bluetooth devices"
"${ADB[@]}" shell dumpsys bluetooth_manager 2>/dev/null |
  grep -Ei 'HUAWEI|Huawei|device_type=Watch|com\\.huawei\\.health|DeviceAddress=' |
  head -20 |
  sed 's/^/BT  /' |
  sed -E 's/([0-9A-Fa-fxX]{2}:){5}[0-9A-Fa-fxX]{2}/XX:XX:XX:XX:XX:XX/g' ||
  true
