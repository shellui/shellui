---
title: Local dev stack
sidebar_label: Dev stack
description: Run the Shellui shell, backends, admin, dashboard, and files together with Docker Compose.
---

The full stack is orchestrated from **`dev/docker-compose.yml`** in this repository. Secrets and URLs live in **`.env.local`** at the repo root (copy from `.env.local.example` or run `./generate-env.sh`).

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

From the **shellui monorepo root**:

```bash
./generate-env.sh
docker compose -f compose.dev.yml --env-file .env.local up --build
```

Never commit `.env.local`.

## Ports

| Service   | Host port |
| --------- | --------- |
| shell     | 4000      |
| identity  | 8001      |
| storage   | 8002      |
| hosting   | 8003      |
| email     | 8004      |
| saas      | 8005      |
| ai        | 8006      |
| admin     | 5173      |
| dashboard | 5174      |
| files     | 5175      |
| Postgres  | 5432      |
| Redis     | 6379      |
| Mailpit UI | 8025     |
| Mailpit SMTP | 1025   |

Public URLs use `http://localhost:<port>`. JWKS fetch, webhooks, and MCP forwarding inside Docker use `http://<compose-service-name>:8000`.

## Redis

One Redis instance; each backend uses a distinct logical DB index (identity `0` through ai `5`). Values are set in `.env.local.example` as `*_REDIS_URL`.

## Workers

Django **dev** targets run `runserver` only (no Celery in those containers). Sign-in and Mailpit SMTP do not require email lane workers. To deliver mail through the email-service API, register a service key (see `dev/README.md`) and start the optional worker profile:

```bash
docker compose -f compose.dev.yml --env-file .env.local --profile workers up -d email-worker
```

## This repository in the stack

The **shell** service builds the `dev` target from the root [Dockerfile](https://github.com/shellui/shellui/blob/develop/Dockerfile), bind-mounts the monorepo, and runs the CLI dev server on port 4000 with [dev/shellui.config.json](https://github.com/shellui/shellui/blob/develop/dev/shellui.config.json).

**admin** mounts the same checkout at `/opt/shellui` so Vite resolves `@shellui/core` from your local tree (`SHELLUI_ROOT`).

Per-service variables are documented in each sibling repo (`docs/devstack.md`, `docs/local-dev-stack.md`, or `docs/dev-stack.md` on `develop`).
