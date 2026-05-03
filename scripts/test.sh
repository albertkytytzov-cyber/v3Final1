#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "No dedicated automated test runner is configured yet."
echo "Use scripts/lint.sh for the current lint and typecheck quality gate."
