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
for repo in shellui identity-service storage-service hosting-service email-service saas-service ai-service admin dashboard files playground; do
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
  playground/
```

`saas-service` and `dashboard` are private. Clone them with access to the Shellui org.

## 2. Start

```bash
cd shellui/dev
./start.sh
```

On first run, `start.sh` creates `dev/.env.local` with fresh secrets. Later runs keep it and only append variables added to the example since (`generate-env.sh`, which uses `uv run` when available, else `python3`). It then runs `docker compose --env-file .env.local up --build` with the full stack, `email-worker` included. Extra arguments go to Compose, for example `./start.sh -d`.

Never commit `dev/.env.local`.

## 3. Open

| Service         | URL                   |
| --------------- | --------------------- |
| shell           | http://localhost:4000 |
| identity        | http://localhost:8001 |
| identity-global | http://localhost:8007 |
| storage         | http://localhost:8002 |
| hosting         | http://localhost:8003 |
| email           | http://localhost:8004 |
| saas            | http://localhost:8005 |
| ai              | http://localhost:8006 |
| admin           | http://localhost:5173 |
| dashboard       | http://localhost:5174 |
| files           | http://localhost:5175 |
| playground      | http://localhost:5176 |
| Mailpit UI      | http://localhost:8025 |
| Mailpit SMTP    | `localhost:1025`      |
| Postgres        | `localhost:5432`      |
| Redis           | `localhost:6379`      |

Browser URLs and token issuers use `http://${DEV_PUBLIC_HOST}:<port>`. The example sets `DEV_PUBLIC_HOST` to a Tailscale address. Set it to `localhost` when the browser is on the same machine. The table lists the ports. identity-global is port 8007. In the steps below, use that host in place of `localhost` when it is not `localhost`. Calls between containers use `http://<service>:8000`, for example `http://identity:8000/.well-known/jwks.json` and `http://identity-global:8000/.well-known/jwks.json`.

## Which identity each app uses

The stack always starts two identity-service processes. They do not share a database, a Redis DB index, a `SECRET_KEY`, or a JWT signing key. `SHELLUI_INSTANCE_ROLE` is `region` on `identity` and `global` on `identity-global`.

| App                             | Identity | How it is reached                                       |
| ------------------------------- | -------- | ------------------------------------------------------- |
| shell, admin, files, playground | region   | http://localhost:8001                                   |
| storage, hosting, email, ai     | region   | `http://identity:8000` on the Compose network           |
| dashboard                       | global   | http://localhost:8007 (`IDENTITY_SERVICE_URL`)          |
| saas                            | global   | `http://identity-global:8000` (`IDENTITY_INTERNAL_URL`) |

`REGION_CH_IDENTITY_ORIGIN` stays http://localhost:8001. The dashboard uses that value for the `ch` region row. Sign-in for the dashboard itself uses identity-global.

Regional identity trusts two issuers. It does not fetch either JWKS over the network.

User tokens come from identity-global:

- `GLOBAL_ISSUER_URL` is http://localhost:8007. The user token `iss` must match that origin.
- `GLOBAL_ISSUER_INTERNAL_URL` is `http://identity-global:8000`, for code exchange inside Compose.
- `GLOBAL_JWKS` is identity-global's public key.
- `GLOBAL_ACCESS_TOKEN_AUDIENCE` is `shellui_global`, the same value as identity-global `JWT_AUDIENCE`.
- `GLOBAL_CLIENT_ID` and `GLOBAL_CLIENT_SECRET` match `IDENTITY_GLOBAL_OIDC_CLIENTS` on identity-global.

Agent tokens come from saas. saas keeps its own OAuth server for the global MCP. Its process `GLOBAL_ISSUER_URL` is http://localhost:8005, and that is the agent token `iss`.

- `GLOBAL_AGENT_ISSUER_URL` on regional identity is http://localhost:8005.
- `GLOBAL_AGENT_JWKS` is the public key of `GLOBAL_AGENT_SIGNING_KEY`. That PEM is not identity-global's JWT key.
- `GLOBAL_AGENT_KEY_ID` is the `kid` in `GLOBAL_AGENT_JWKS`.
- `GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE` is `shellui_global_agent_dev`. saas and regional identity both read that name.

## Try the global to regional exchange

Use a non-staff account. `admin` / `admin` is staff on both databases. Regional identity refuses staff on token exchange (RFC 8693).

1. Open the dashboard at http://localhost:5174. Sign-in goes to identity-global at http://localhost:8007, company 1. Request a magic link for `dev@localhost` and open it from Mailpit at http://localhost:8025. The shell at http://localhost:4000 still signs in at http://localhost:8001.
2. In the dashboard, create or connect a company. SaaS calls the regional provisioning API on http://localhost:8001. The regional database already has company 1 (Shellui Dev, public access) from `seed_dev`, which is enough for a local exchange target.
3. Global MCP is `POST http://localhost:8005/mcp`. After global MCP consent, exchange that global agent access token for a company MCP token. `SUBJECT_TOKEN` is the saas agent JWT (`iss` http://localhost:8005, `aud` `shellui_global_agent_dev`).

```bash
G=urn:ietf:params:oauth:grant-type:token-exchange
A=urn:ietf:params:oauth:token-type:access_token
curl -sS -X POST "http://localhost:8001/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=${G}" \
  --data-urlencode "subject_token=${SUBJECT_TOKEN}" \
  --data-urlencode "subject_token_type=${A}" \
  --data-urlencode "requested_token_type=${A}" \
  --data-urlencode "company_id=1" \
  --data-urlencode "resource=http://localhost:8006/c/1/mcp" \
  --data-urlencode "access_mode=read_only" \
  --data-urlencode "read_level=safe" \
  --data-urlencode "allow_destructive=false" \
  --data-urlencode "services=identity" \
  --data-urlencode "services=storage"
```

The response is a regional token whose `aud` is `http://localhost:8006/c/1/mcp`. Send that token to the company MCP URL. Do not send the global JWT there.

A global user access token (magic link on identity-global, `aud` `shellui_global`, `token_type` `access`) uses the same token endpoint with `company_id` and no `resource`. The regional server returns a regional session for that company.

4. Device login stays on the regional server. The client calls `POST http://localhost:8001/oauth/mcp/device/code` with `resource` set to `http://localhost:8006/c/1/mcp`. Open http://localhost:8001/oauth/mcp/device, sign in with `dev@localhost` on the regional server (http://localhost:8001), and allow the code. Staff cannot approve.

## Common commands

Run these from `shellui/dev`.

```bash
./start.sh -d                                      # start in the background
docker compose --env-file .env.local logs -f identity   # follow one service
docker compose --env-file .env.local down          # stop everything
./start.sh -d identity                             # rebuild and restart one service
docker compose --env-file .env.local exec identity python manage.py createsuperuser  # extra users; admin/admin is seeded
docker compose --env-file .env.local down -v       # stop and delete all data volumes
```

## Troubleshooting

- **A build fails on a sibling repo.** Pull `develop` in that repo. Every image needs a `dev` target in its Dockerfile.
- **Port already in use.** Stop the local process on that port, or the other stack using it.
- **Postgres auth fails after new secrets.** You removed `.env.local` but kept old volumes. Run `docker compose --env-file .env.local down -v`, then `./start.sh`.
- **`identity-global` cannot connect to Postgres.** The data volume was created before `identity_global` existed. Init runs only on an empty volume. Create the database, then start the service (commands below).
- **No hot reload on macOS.** Set `DEV_FILE_WATCH_POLLING=true` in `dev/.env.local`, then restart the front-end service. Docker Desktop virtiofs usually works with inotify when polling is off.
- **High idle CPU.** Defaults favor inotify and slower Django or worker polls. Raise `DEV_FILE_WATCH_POLLING`, lower `DJANGO_STATRELOAD_SLEEP`, or lower `EMAIL_LANE_WORKER_POLL_SECONDS` only if you need snappier reloads.
- **Compose stop shows `Error while Killing`.** Update Docker Compose (Desktop includes it). The dev stack does not set a restart policy so `docker compose down` and Ctrl-C on `./start.sh` can stop containers without racing the engine. Services use `init: true` so SIGTERM reaches runserver, Vite, and the email worker children.
- **Dependencies changed.** Rebuild that service: `./start.sh -d <service>`.
- **`generate-env.sh` fails.** Check that `uv` or `python3`, and `openssl`, are on `PATH`.

## Global issuer keys (dev)

`dev/generate_env.py` fills two RSA keys. identity-global's JWT key feeds **`GLOBAL_JWKS`**. **`GLOBAL_AGENT_SIGNING_KEY`** feeds **`GLOBAL_AGENT_JWKS`** and **`GLOBAL_AGENT_KEY_ID`**. On every run the script rebuilds both JWKS from those PEMs. An existing file keeps each private key. If the two PEMs are the same, the script generates a new identity-global key and leaves the SaaS key in place. It appends missing names and does not replace `POSTGRES_PASSWORD`.

`dev/docker-compose.yml` passes `GLOBAL_ISSUER_URL` (http://localhost:8007), `GLOBAL_JWKS`, `GLOBAL_ACCESS_TOKEN_AUDIENCE`, `GLOBAL_AGENT_ISSUER_URL` (http://localhost:8005), `GLOBAL_AGENT_JWKS`, and `GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE` into **identity**. saas receives `GLOBAL_ISSUER_URL` http://localhost:8005, plus `GLOBAL_AGENT_SIGNING_KEY`, `GLOBAL_AGENT_KEY_ID`, and `GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`. See [Identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md). **`GLOBAL_AGENT_PRIVATE_KEY`** is not used in **`dev/.env.local.example`**.

## Migrate an existing local stack

From `shellui/dev`, refresh the env file. New names are appended. Private keys that are already set stay, except when identity-global's key is the same PEM as `GLOBAL_AGENT_SIGNING_KEY`: then identity-global gets a new key. `GLOBAL_JWKS`, `GLOBAL_AGENT_JWKS`, and `GLOBAL_AGENT_KEY_ID` are rewritten so they match those PEMs.

```bash
./generate-env.sh
```

Postgres init runs only when the data volume is empty. If `identity-global` logs that database `identity_global` does not exist, create it and start that service:

```bash
docker compose --env-file .env.local exec postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE identity_global;"'
./start.sh -d identity-global
```

`CREATE DATABASE` fails when the database is already there. Leave the volume in place and rerun the start command. To drop every database and secret, remove `.env.local` and run `docker compose --env-file .env.local down -v`, then `./start.sh`.

## Redis

One Redis instance. Each backend uses its own DB: identity `0`, storage `1`, hosting `2`, email `3`, saas `4`, ai `5`, identity-global `6`. Values live in `dev/.env.local.example` as `*_REDIS_URL`.

## Workers

The Django dev containers run `runserver` only. `email-worker` runs lane delivery and the scheduler, and starts with `./start.sh` by default.

## Email

Mail lands in Mailpit at http://localhost:8025. `generate-env.sh` writes one email-service key per caller (`IDENTITY_`, `STORAGE_`, `HOSTING_`, `SAAS_` and `AI_EMAIL_SERVICE_API_KEY`). On start, email-service registers them from `EMAIL_DEV_SERVICE_KEYS`, storing only their hashes. Nothing to do by hand. This only runs with `DEBUG=true`, so production never seeds keys.

## This repository in the stack

The **shell** service builds the `dev` target from the root [Dockerfile](https://github.com/shellui/shellui/blob/develop/Dockerfile), bind-mounts the monorepo at `/app`, and runs the CLI dev server on port 4000 with the split config in [dev/config/](https://github.com/shellui/shellui/tree/develop/dev/config) (one `shellui.<section>.config.json` per section, like `shellui config split` writes).

### Local `@shellui/*` packages (no npm publish)

The dev stack bind-mounts this monorepo into every front-end container at `/opt/shellui` (read-only). Scripts in [dev/container/](https://github.com/shellui/shellui/tree/develop/dev/container) run on container start:

1. **`link-local-shellui-packages.mjs`** replaces `node_modules/@shellui/*` with symlinks into `/opt/shellui/packages/*` for every `@shellui` dependency declared in that app (lockfiles stay on published versions; only the Compose `node_modules` volume is touched).
2. **`run-vite-dev.mjs`** loads the app’s normal `vite.config.*` and adds Vite aliases so `@shellui/sdk` and `@shellui/core` resolve to TypeScript source for hot reload.

**shell** already runs from the mounted monorepo workspace (`/app`). **admin**, **dashboard**, **files**, and **playground** use the shared entrypoint and Vite wrapper. Production Dockerfiles and CI are unchanged.

After you change `pnpm-lock.yaml` in a sibling app, rebuild that service: `./start.sh -d <service>`.

**playground** runs the [playground](https://github.com/shellui/playground) Vite dev server on port 5176 with hot reload (`PLAYGROUND_DEV_PORT`). Admin owns 5173 in the stack.

**files** runs on port 5175 with `VITE_STORAGE_URL`, `VITE_IDENTITY_URL`, and HMR env vars set in compose. The shell config sets `storage.url` to `http://localhost:8002` and `storage.filesUrl` to `http://localhost:5175/` via `PUBLIC_STORAGE_URL` and `PUBLIC_FILES_URL`.

### Shell service env

The files in `dev/config/` resolve `${VAR:-default}` placeholders from the container environment (same names as `dev/.env.local`).

| `dev/.env.local` variable   | Purpose                                      |
| --------------------------- | -------------------------------------------- |
| `PUBLIC_IDENTITY_URL`       | `backend.url`                                |
| `PUBLIC_ADMIN_URL`          | `backend.adminUrl`                           |
| `PUBLIC_EMAIL_URL`          | `email.url`                                  |
| `PUBLIC_STORAGE_URL`        | `storage.url`                                |
| `PUBLIC_FILES_URL`          | `storage.filesUrl`                           |
| `PUBLIC_HOSTING_URL`        | `hosting.url`                                |
| `PUBLIC_AI_URL`             | `aiService.url`                              |
| `SHELL_IDENTITY_COMPANY_ID` | `backend.companyId`                          |
| `PUBLIC_PLAYGROUND_URL`     | playground navigation (`PLAYGROUND_APP_URL`) |

### Sign in

Both identity processes seed themselves on every start (`IDENTITY_DEV_SEED=true` in the compose file, and only when `DEBUG=true`). `seed_dev` does not take a role flag, so each database gets the same rows. There is nothing to create by hand:

- **Company 1**, named Shellui Dev, with magic link on and the dev front-ends (ports 4000, 5173 to 5176) allowed as redirects.
- **`admin` / `admin`**, a superuser on each identity admin (http://localhost:8001/admin/ and http://localhost:8007/admin/) and the admin app. Local only. Staff accounts cannot use magic links, so sign in with the password. Regional token exchange refuses staff.
- **`dev@localhost`**, a normal member of company 1 for magic link. Request a link in the shell (http://localhost:4000, regional identity) or the dashboard (http://localhost:5174, identity-global) and open it from Mailpit (http://localhost:8025).

The seed never overwrites existing rows, so a changed admin password or company settings survive restarts. To start fresh, run `docker compose --env-file .env.local down -v`.

Sign-in stays in the browser across tabs. The dev shell sets `security.bffAuth.enabled` in `dev/config/shellui.security.config.json`. The CLI dev server stores the refresh token in an HttpOnly `shellui_refresh` cookie on `/api/auth`, without the Secure flag on http://localhost. The browser still calls identity at http://localhost:8001. Inside the shell container, refresh uses `http://identity:8000` (`SHELLUI_BFF_BACKEND_URL`), the same identity on the Compose network. A saved profile that cannot be restored is cleared, and the login page comes back.

GitHub is optional. Without credentials the stack starts normally and only the GitHub button fails. To enable it, create a GitHub OAuth app with homepage `http://localhost:4000` and the callback URL identity shows in its OAuth setup, then add the client ID and secret to company 1 in the admin app (http://localhost:5173) or the identity admin. Credentials are stored per company, not in `.env.local`.

### SaaS API CORS

`saas-service` reads `CORS_ALLOWED_ORIGINS` from compose. The generated `dev/.env.local` sets `SAAS_CORS_ALLOWED_ORIGINS` to the shell (`http://localhost:4000` and `http://127.0.0.1:4000`) and the global dashboard Vite app (`http://localhost:5174` and `http://127.0.0.1:5174`). If you change `PUBLIC_SHELL_URL` or serve the dashboard on another origin, append that origin to `SAAS_CORS_ALLOWED_ORIGINS` and run `docker compose --env-file .env.local up -d saas` (or `./start.sh`). Internal service calls use Docker network URLs (`http://saas:8000`); they do not rely on this list.

Service-specific notes live in each repo: [identity](https://github.com/shellui/identity-service/blob/develop/docs/local-dev-stack.md), [storage](https://github.com/shellui/storage-service/blob/develop/docs/devstack.md), [hosting](https://github.com/shellui/hosting-service/blob/develop/docs/local-dev-stack.md), [email](https://github.com/shellui/email-service/blob/develop/docs/devstack.md), [saas](https://github.com/shellui/saas-service/blob/develop/docs/dev-stack.md), [ai](https://github.com/shellui/ai-service/blob/develop/docs/devstack.md) and [dashboard](https://github.com/shellui/dashboard/blob/develop/docs/devstack.md).
