---
title: Local dev stack
sidebar_label: Dev stack
description: Run the Shellui shell, backends, admin, dashboard, and files together with Docker Compose.
---

The full stack lives under **`dev/`** in this repository: `docker-compose.yml`, `.env.local.example`, `generate-env.sh`, and related files. Generated secrets go in **`dev/.env.local`** (gitignored).

## Clone layout

```text
shellui/
  shellui/
  identity-service/
  storage-service/
  hosting-service/
  email-service/
  saas-service/
  ai-service/
  admin/
  dashboard/
  files/
```

`saas-service` and `dashboard` are private. Clone them with access to the Shellui org.

## Start

```bash
shellui/dev/start.sh
```

On first run, `start.sh` creates `dev/.env.local` from the example (via `generate-env.sh`). Extra arguments go to Docker Compose (`-d`, `--profile workers`, a service name, and so on).

Never commit `dev/.env.local`.

## Prerequisites

- Docker Compose v2
- **uv** or **Python 3** for `./generate-env.sh` (stdlib-only `generate_env.py`; prefers `uv run --no-project python` when `uv` is on `PATH`)
- **OpenSSL** (`openssl` CLI for generated JWT and signing keys)
- Sibling service repos on `develop` with a Dockerfile **`dev`** target (storage-service: merge [PR #52](https://github.com/shellui/storage-service/pull/52) when available)

## Ports

| Service      | Host port |
| ------------ | --------- |
| shell        | 4000      |
| identity     | 8001      |
| storage      | 8002      |
| hosting      | 8003      |
| email        | 8004      |
| saas         | 8005      |
| ai           | 8006      |
| admin        | 5173      |
| dashboard    | 5174      |
| files        | 5175      |
| Postgres     | 5432      |
| Redis        | 6379      |
| Mailpit UI   | 8025      |
| Mailpit SMTP | 1025      |

Public URLs use `http://localhost:<port>`. JWKS fetch, webhooks, and MCP forwarding inside Docker use `http://<compose-service-name>:8000`.

## Redis

One Redis instance; each backend uses a distinct logical DB index (identity `0` through ai `5`). Values are set in `dev/.env.local.example` as `*_REDIS_URL`.

## Workers

Django **dev** targets run `runserver` only (no Celery in those containers). Sign-in and Mailpit SMTP do not require email lane workers. To deliver mail through the email-service API, register a service key (see `dev/README.md`) and start the optional worker profile:

```bash
cd shellui/dev
docker compose --env-file .env.local --profile workers up -d email-worker
```

## This repository in the stack

The **shell** service builds the `dev` target from the root [Dockerfile](https://github.com/shellui/shellui/blob/develop/Dockerfile), bind-mounts the monorepo at `/app`, and runs the CLI dev server on port 4000 with [dev/shellui.config.json](https://github.com/shellui/shellui/blob/develop/dev/shellui.config.json).

**admin** mounts the monorepo at `/opt/shellui` so Vite resolves `@shellui/core` from your local tree (`SHELLUI_ROOT`).

**files** runs on port 5175 with `VITE_STORAGE_URL`, `VITE_IDENTITY_URL`, and HMR env vars set in compose. The shell config sets `storage.url` to `http://localhost:8002` and `storage.filesUrl` to `http://localhost:5175/` via `PUBLIC_STORAGE_URL` and `PUBLIC_FILES_URL`.

### Shell service env

[dev/shellui.config.json](https://github.com/shellui/shellui/blob/develop/dev/shellui.config.json) resolves `${PUBLIC_*}` placeholders from the container environment (same names as `dev/.env.local`).

| `dev/.env.local` variable   | Purpose             |
| --------------------------- | ------------------- |
| `PUBLIC_IDENTITY_URL`       | `backend.url`       |
| `PUBLIC_ADMIN_URL`          | `backend.adminUrl`  |
| `PUBLIC_EMAIL_URL`          | `email.url`         |
| `PUBLIC_STORAGE_URL`        | `storage.url`       |
| `PUBLIC_FILES_URL`          | `storage.filesUrl`  |
| `PUBLIC_HOSTING_URL`        | `hosting.url`       |
| `SHELL_IDENTITY_COMPANY_ID` | `backend.companyId` |

More operator detail: [dev/README.md](https://github.com/shellui/shellui/blob/develop/dev/README.md).

Per-service variables are documented in each sibling repo on `develop` (`docs/devstack.md`, `docs/local-dev-stack.md`, or similar).
