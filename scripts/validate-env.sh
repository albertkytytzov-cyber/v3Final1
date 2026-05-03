#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${1:-.env}"

fail() {
  echo "$1" >&2
  exit 1
}

read_env_value() {
  local key="$1"
  (grep -E "^${key}=" "$ENV_FILE" || true) | tail -n 1 | cut -d '=' -f 2- | tr -d '\r'
}

is_weak_secret() {
  local value="$1"
  [ -z "$value" ] ||
    [ "$value" = "change-me" ] ||
    [ "$value" = "change-me-in-production" ] ||
    [ "$value" = "change-me-postgres-password" ] ||
    [ "$value" = "postgres" ]
}

[ -f "$ENV_FILE" ] || fail "$ENV_FILE is required."

PUBLIC_HOST_VALUE="$(read_env_value "PUBLIC_HOST")"
POSTGRES_PASSWORD_VALUE="$(read_env_value "POSTGRES_PASSWORD")"
SESSION_SECRET_VALUE="$(read_env_value "SESSION_SECRET")"
SESSION_COOKIE_SECURE_VALUE="$(read_env_value "SESSION_COOKIE_SECURE")"
SEED_DEMO_DATA_VALUE="$(read_env_value "SEED_DEMO_DATA")"

if [ -z "${PUBLIC_HOST_VALUE:-}" ] || [ "${PUBLIC_HOST_VALUE:-}" = "change-me.example.com" ]; then
  fail "PUBLIC_HOST must be set to a real domain or a temporary sslip.io/nip.io host before launch."
fi

if is_weak_secret "${POSTGRES_PASSWORD_VALUE:-}"; then
  fail "POSTGRES_PASSWORD must be set to a strong non-default value before launch."
fi

if is_weak_secret "${SESSION_SECRET_VALUE:-}" || [ "${#SESSION_SECRET_VALUE}" -lt 32 ]; then
  fail "SESSION_SECRET must be set to a strong non-default value with at least 32 characters before launch."
fi

if [ "${SESSION_COOKIE_SECURE_VALUE:-}" != "true" ]; then
  fail "SESSION_COOKIE_SECURE=true is required before launch."
fi

if [ "${SEED_DEMO_DATA_VALUE:-false}" = "true" ]; then
  fail "SEED_DEMO_DATA=true is not allowed for launch."
fi

echo "Environment validation passed."
