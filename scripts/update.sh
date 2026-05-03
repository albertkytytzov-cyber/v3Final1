#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

bash scripts/validate-env.sh

if [ "${SKIP_BACKUP:-0}" != "1" ]; then
  bash scripts/backup.sh
fi

docker compose pull postgres redis reverse-proxy || true
docker compose up -d --build
docker compose up -d --force-recreate reverse-proxy
docker compose ps
