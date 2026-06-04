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

echo
echo "Huawei packages"
for package_name in com.huawei.hwid com.huawei.health; do
  if adb shell pm path "$package_name" >/dev/null 2>&1; then
    version="$(adb shell dumpsys package "$package_name" 2>/dev/null | awk -F= '/versionName=/{ print $2; exit }' | tr -d '\r')"
    echo "OK  $package_name ${version:-installed}"
  else
    echo "NO  $package_name missing"
  fi
done

echo
echo "PERFORM package"
if adb shell pm path com.perform.training >/dev/null 2>&1; then
  version="$(adb shell dumpsys package com.perform.training 2>/dev/null | awk -F= '/versionName=/{ print $2; exit }' | tr -d '\r')"
  echo "OK  com.perform.training ${version:-installed}"
else
  echo "NO  com.perform.training is not installed"
fi
