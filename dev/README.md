# Shellui local dev stack

Docker Compose for the full Shellui stack lives in this directory. Environment variables live at the **repository root** (`.env.local.example`, generated `.env.local`).

## Clone layout

```text
shellui/
  shellui/              ← this monorepo
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

## Start

From the **shellui monorepo root**:

```bash
./generate-env.sh
docker compose -f compose.dev.yml --env-file .env.local up --build
```

Equivalent:

```bash
docker compose -f dev/docker-compose.yml --env-file .env.local up --build
```

Mailpit UI: http://localhost:8025 (SMTP on port 1025).

| Service   | URL |
| --------- | --- |
| shell     | http://localhost:4000 |
| identity  | http://localhost:8001 |
| storage   | http://localhost:8002 |
| hosting   | http://localhost:8003 |
| email     | http://localhost:8004 |
| saas      | http://localhost:8005 |
| ai        | http://localhost:8006 |
| admin     | http://localhost:5173 |
| dashboard | http://localhost:5174 |
| files     | http://localhost:5175 |

Browser-facing URLs use `localhost`. Container-to-container calls use `http://<service>:8000`.

## Redis DB indexes

| Service  | Redis URL index |
| -------- | --------------- |
| identity | 0               |
| storage  | 1               |
| hosting  | 2               |
| email    | 3               |
| saas     | 4               |
| ai       | 5               |

## Email

Identity can send auth mail through Mailpit via direct SMTP while `EMAIL_SERVICE_API_KEY` is unset.

For **email-service** HTTP sends (`/send`, and so on), register an `esk_` key and start lane workers:

```bash
docker compose -f compose.dev.yml --env-file .env.local exec email \
  python manage.py create_service_key --service identity
```

Update `IDENTITY_EMAIL_SERVICE_API_KEY` in `.env.local` with the printed key, restart callers, then:

```bash
docker compose -f compose.dev.yml --env-file .env.local --profile workers up -d email-worker
```

## Admin and Shellui core

The admin `dev` image reads `@shellui/core` from `SHELLUI_ROOT` (default `/opt/shellui`). Compose bind-mounts this monorepo at `/opt/shellui` so core edits hot reload in admin.

## Requirements

- Docker Compose v2
- Sibling repos on `develop` with a `dev` Dockerfile target
- OpenSSL (for `./generate-env.sh`)

See [Local dev stack](../docs/dev-stack.md).
