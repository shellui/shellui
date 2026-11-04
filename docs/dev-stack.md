---
title: Local dev stack
sidebar_label: Dev stack
description: Run the Shellui shell, backends, admin, dashboard, and files together with Docker Compose.
---

The dev stack is the recommended way to run Shellui locally. One command starts every backend, every front-end, Postgres, Redis and Mailpit. Your code is mounted from disk, so Django reloads and Vite hot reloads on save.

## Requirements

- Docker with Compose v2
- `uv` or Python 3 (to generate `.env.local`)
- OpenSSL

## 1. Clone the repos side by side

```bash
mkdir shellui && cd shellui
for repo in shellui identity-service storage-service hosting-service email-service saas-service ai-service admin dashboard files; do
  git clone -b develop git@github.com:shellui/$repo.git
done
```

You should end up with:

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

## 2. Start

```bash
cd shellui/dev
./start.sh
```

On first run, `start.sh` creates `dev/.env.local` with fresh secrets (`generate-env.sh`, which uses `uv run` when available, else `python3`). It then runs `docker compose --env-file .env.local up --build` with the full stack, `email-worker` included. Extra arguments go to Compose, for example `./start.sh -d`.

Never commit `dev/.env.local`.

## 3. Open

| Service      | URL                   |
| ------------ | --------------------- |
| shell        | http://localhost:4000 |
| identity     | http://localhost:8001 |
| storage      | http://localhost:8002 |
| hosting      | http://localhost:8003 |
| email        | http://localhost:8004 |
| saas         | http://localhost:8005 |
| ai           | http://localhost:8006 |
| admin        | http://localhost:5173 |
| dashboard    | http://localhost:5174 |
| files        | http://localhost:5175 |
| Mailpit UI   | http://localhost:8025 |
| Mailpit SMTP | `localhost:1025`      |
| Postgres     | `localhost:5432`      |
| Redis        | `localhost:6379`      |

Browser URLs and token issuers use `http://localhost:<port>`. Calls between containers use `http://<service>:8000`, for example `http://identity:8000/.well-known/jwks.json`.

## Common commands

Run these from `shellui/dev`.

```bash
./start.sh -d                                      # start in the background
docker compose --env-file .env.local logs -f identity   # follow one service
docker compose --env-file .env.local down          # stop everything
./start.sh -d identity                             # rebuild and restart one service
docker compose --env-file .env.local exec identity python manage.py createsuperuser
docker compose --env-file .env.local down -v       # stop and delete all data volumes
```

## Troubleshooting

- **A build fails on a sibling repo.** Pull `develop` in that repo. Every image needs a `dev` target in its Dockerfile.
- **Port already in use.** Stop the local process on that port, or the other stack using it.
- **Postgres auth fails after new secrets.** You removed `.env.local` but kept old volumes. Run `docker compose --env-file .env.local down -v`, then `./start.sh`.
- **No hot reload on macOS.** The front-ends already poll (`CHOKIDAR_USEPOLLING`, `VITE_USE_POLLING`). Restart the service if a change is still missed.
- **Dependencies changed.** Rebuild that service: `./start.sh -d <service>`.
- **`generate-env.sh` fails.** Check that `uv` or `python3`, and `openssl`, are on `PATH`.

## Redis

One Redis instance. Each backend uses its own DB: identity `0`, storage `1`, hosting `2`, email `3`, saas `4`, ai `5`. Values live in `dev/.env.local.example` as `*_REDIS_URL`.

## Workers

The Django dev containers run `runserver` only. `email-worker` runs lane delivery and the scheduler, and starts with `./start.sh` by default.

## Email

Mail lands in Mailpit at http://localhost:8025. `generate-env.sh` writes a random `IDENTITY_EMAIL_SERVICE_API_KEY` that email-service does not know yet. To call the email-service HTTP API, create a real key once the stack is up:

```bash
docker compose --env-file .env.local exec email \
  python manage.py create_service_key --service identity
```

Put it in `IDENTITY_EMAIL_SERVICE_API_KEY` in `.env.local`, then restart identity, storage, hosting, saas and ai.

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

Service-specific notes live in each repo: [identity](https://github.com/shellui/identity-service/blob/develop/docs/local-dev-stack.md), [storage](https://github.com/shellui/storage-service/blob/develop/docs/devstack.md), [hosting](https://github.com/shellui/hosting-service/blob/develop/docs/local-dev-stack.md), [email](https://github.com/shellui/email-service/blob/develop/docs/devstack.md), [saas](https://github.com/shellui/saas-service/blob/develop/docs/dev-stack.md), [ai](https://github.com/shellui/ai-service/blob/develop/docs/devstack.md) and [dashboard](https://github.com/shellui/dashboard/blob/develop/docs/devstack.md).
