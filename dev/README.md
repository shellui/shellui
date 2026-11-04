# Shellui local dev stack

Everything for the local Docker stack lives in this directory.

## Clone layout

```text
shellui/
  shellui/              ← this monorepo (you are in shellui/dev/)
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

Compose build contexts use `../../<repo>` for siblings and `..` for this monorepo (shell service).

## Start

```bash
cd shellui/dev
./generate-env.sh
docker compose --env-file .env.local up --build
```

Mailpit UI: http://localhost:8025 (SMTP on port 1025).

| Service   | URL                   |
| --------- | --------------------- |
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
docker compose --env-file .env.local exec email \
  python manage.py create_service_key --service identity
```

Update `IDENTITY_EMAIL_SERVICE_API_KEY` in `.env.local`, restart callers, then:

```bash
docker compose --env-file .env.local --profile workers up -d email-worker
```

## Admin and Shellui core

The admin `dev` image reads `@shellui/core` from `SHELLUI_ROOT` (default `/opt/shellui`). Compose bind-mounts the monorepo at `/opt/shellui` so core edits hot reload in admin.

## Requirements

- Docker Compose v2
- Sibling repos on `develop` with a `dev` Dockerfile target
- **uv** or **Python 3** on `PATH` for `./generate-env.sh` (`uv run --no-project python` when `uv` is installed; otherwise `python3`)
- **OpenSSL** on `PATH` (`openssl` for RSA keys in `generate_env.py`)

See [Local dev stack](../docs/dev-stack.md).

## Files in this directory

| File                         | Role                                     |
| ---------------------------- | ---------------------------------------- |
| `docker-compose.yml`         | Full stack                               |
| `.env.local.example`         | Committed env template                   |
| `.env.local`                 | Generated secrets (gitignored)           |
| `generate-env.sh`            | Creates `.env.local` from the example    |
| `generate_env.py`            | Secret generator (stdlib + OpenSSL)      |
| `shellui.config.json`        | Shell dev config for the `shell` service |
| `postgres/init-databases.sh` | One Postgres database per backend        |
