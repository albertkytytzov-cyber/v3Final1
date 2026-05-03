# Self-Host MVP Deployment

This package is intended for a small Ubuntu self-hosted MVP with Docker Compose and built-in HTTPS termination through Caddy.

## Prerequisites

- Ubuntu Server 24.04 LTS or 22.04 LTS.
- Docker Engine with the Docker Compose plugin.
- Open inbound ports `80` and `443`.
- At least 2 CPU cores, 4 GB RAM, and persistent disk for PostgreSQL.
- A public hostname that resolves to the server.

For a temporary MVP hostname without manual DNS, you can use:

- `SERVER_IP.sslip.io`
- `SERVER-IP.nip.io`

Example for server `203.0.113.10`:

- `203.0.113.10.sslip.io`

## Environment Setup

```bash
cp .env.example .env
```

Before public use, update at least:

- `PUBLIC_HOST`
- `SESSION_SECRET`
- `POSTGRES_PASSWORD`
- `SESSION_COOKIE_SECURE=true`
- `SEED_DEMO_DATA=false`
- `HTTP_PORT` / `HTTPS_PORT` only if `80` / `443` are already used
- `BACKUP_RETENTION_DAYS` if you need a retention window other than 14 days

`scripts/install.sh` and `scripts/update.sh` run `scripts/validate-env.sh` before changing containers. Launch is blocked if:

- `PUBLIC_HOST` is still `change-me.example.com`;
- `SESSION_SECRET` is missing, weak, or shorter than 32 characters;
- `POSTGRES_PASSWORD` is missing or still a default value;
- `SESSION_COOKIE_SECURE` is not `true`;
- `SEED_DEMO_DATA=true`.

The compose stack uses the internal Docker hostnames `postgres`, `redis`, `api`, and `web`, so local `DATABASE_URL=localhost` in `.env` does not break self-host mode.

## Install

```bash
bash scripts/install.sh
```

The script validates `PUBLIC_HOST`, builds the images, starts the services, recreates the reverse proxy, and prints `docker compose ps`.

Main entry points:

- Product UI: `https://PUBLIC_HOST/`
- API health: `https://PUBLIC_HOST/api/v1/health`
- Direct web port, if exposed: `http://SERVER_IP:3000/`
- Direct API port, if exposed: `http://SERVER_IP:4000/api/v1/health`

## Update

```bash
bash scripts/update.sh
```

By default, update runs a PostgreSQL backup first. To skip that only when you intentionally want to:

```bash
SKIP_BACKUP=1 bash scripts/update.sh
```

The update script also recreates the reverse proxy so upstream container IP changes do not leave stale routes in place.

## Backup

```bash
bash scripts/backup.sh
```

Backups are written to `backups/training_platform_YYYYMMDDTHHMMSSZ.sql`.
Retention defaults to 14 days and can be changed with:

```bash
BACKUP_RETENTION_DAYS=7 bash scripts/backup.sh
```

## Restore

Restore from a backup file:

```bash
bash scripts/restore.sh backups/training_platform_YYYYMMDDTHHMMSSZ.sql
```

The restore script:

- stops app-facing services,
- recreates the `public` schema,
- restores the SQL dump,
- starts the app services again,
- recreates the reverse proxy.

## Services

- `reverse-proxy`: Caddy public entrypoint with automatic HTTPS.
- `web`: Next.js standalone app.
- `api`: Fastify API with `/api/v1/health`.
- `postgres`: persistent PostgreSQL 16 volume.
- `redis`: persistent Redis 7 append-only storage.
- `worker`: background cleanup runtime for expired sessions.
- `scheduler`: scheduled analytics/log heartbeat runtime for MVP operations.

## Health Checks

```bash
docker compose ps
docker compose logs api --tail=100
docker compose logs web --tail=100
docker compose logs worker --tail=100
docker compose logs scheduler --tail=100
docker compose logs reverse-proxy --tail=100
```

The compose file includes healthchecks and `restart: unless-stopped` for every runtime service.

## HTTPS Notes

- Caddy automatically provisions certificates for `PUBLIC_HOST`.
- `PUBLIC_HOST` must resolve publicly to the server for ACME to succeed.
- Offline/PWA features require secure context, so production use should go through `https://PUBLIC_HOST/`, not raw `http://SERVER_IP/`.
