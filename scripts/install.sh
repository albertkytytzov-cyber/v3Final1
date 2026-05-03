#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Engine and Docker Compose plugin first." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is required." >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Update SESSION_SECRET and POSTGRES_PASSWORD before public use."
fi

bash scripts/validate-env.sh

mkdir -p backups
docker compose up -d --build
docker compose up -d --force-recreate reverse-proxy
docker compose ps
