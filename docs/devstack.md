---
title: Dev stack (this repo)
sidebar_label: Dev stack env
description: Environment variables for the shellui monorepo service in the shared local Docker Compose stack.
---

# Dev stack (shellui monorepo)

Compose file: `dev/docker-compose.yml`. Start from the repo root with `docker compose -f compose.dev.yml --env-file .env.local up`.

## shell service

| Compose service | Host port | Dockerfile target |
| --------------- | --------- | ----------------- |
| `shell`         | 4000      | `dev`             |

The container bind-mounts this repository at `/app`, keeps `node_modules` in a named volume, and runs:

`node packages/cli/bin/shellui.js start --host --config dev/shellui.config.json`

Set `SHELLUI_HOST=1` so Vite listens on `0.0.0.0`.

### Config and env substitution

[dev/shellui.config.json](https://github.com/shellui/shellui/blob/develop/dev/shellui.config.json) uses `${PUBLIC_*}` and `${SHELL_IDENTITY_COMPANY_ID}` placeholders resolved from the container environment (same names as root `.env.local`).

| `.env.local` variable | Purpose |
| --------------------- | ------- |
| `PUBLIC_SHELL_URL` | Shell origin (documentation; port comes from config `4000`) |
| `PUBLIC_IDENTITY_URL` | `backend.url` |
| `PUBLIC_ADMIN_URL` | `backend.adminUrl` |
| `PUBLIC_EMAIL_URL` | `email.url` |
| `PUBLIC_STORAGE_URL` | `storage.url` |
| `PUBLIC_HOSTING_URL` | `hosting.url` |
| `SHELL_IDENTITY_COMPANY_ID` | `backend.companyId` |

### admin sibling

Admin is a separate compose service. It mounts this repo at **`/opt/shellui`** and sets `SHELLUI_ROOT=/opt/shellui` so admin Vite aliases match local core changes. See [admin development docs](https://github.com/shellui/admin/blob/develop/docs/development.md).

## Files in this repo

| Path | Role |
| ---- | ---- |
| `.env.local.example` | Committed template (prefixed secrets per service) |
| `.env.local` | Generated secrets (gitignored) |
| `compose.dev.yml` | Root entrypoint including `dev/docker-compose.yml` |
| `generate-env.sh` | Fills `.env.local` from the example |
| `dev/postgres/init-databases.sh` | Creates one Postgres DB per backend |

Sibling services document their own variables on `develop`.
