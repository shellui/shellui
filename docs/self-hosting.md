---
title: Self-host Shellui
sidebar_label: Self-hosting
description: 'Run identity, storage, hosting, and email together with Postgres and Redis.'
---

One Compose file starts the open-source Shellui services on a single machine: identity, storage, hosting, and email, with Postgres and Redis. Published images are on Docker Hub. There is no admin container. Use the hosted admin at [https://admin.shellui.com](https://admin.shellui.com), pointed at these services. An embedded admin may come later. The shell and the files app are not in this stack.

## Start

From a checkout of this repository:

```bash
cd deploy
cp .env.example .env
./scripts/generate-secrets.sh
docker compose up -d
./scripts/bootstrap.sh
```

`generate-secrets.sh` fills empty secrets in `deploy/.env` and writes `deploy/secrets/jwks.json`. Do not commit either file. `bootstrap.sh` waits for every health check, then creates an email-service key for identity, storage, and hosting.

These URLs are the proxy-free defaults. `*.localhost` resolves to `127.0.0.1`:

| Service  | URL                              | Django admin |
| -------- | -------------------------------- | ------------ |
| identity | `http://identity.localhost:8000` | `/admin/`    |
| storage  | `http://storage.localhost:8001`  | `/admin/`    |
| hosting  | `http://hosting.localhost:8002`  | `/admin/`    |
| email    | `http://email.localhost:8003`    | `/admin/`    |

## Use the hosted admin

There is no admin container in this stack. Staff and company owners open [https://admin.shellui.com](https://admin.shellui.com) from a shell that points at your services. An embedded admin may come later.

Copy `deploy/shell.example.json` to `shellui.config.json` in a shell project (that filename is gitignored). Set `backend.adminUrl` to `https://admin.shellui.com` and point the service URLs at the table above:

```json
{
  "backend": {
    "type": "shellui",
    "url": "http://identity.localhost:8000",
    "companyId": 1,
    "adminPathname": "/admin",
    "adminUrl": "https://admin.shellui.com"
  },
  "storage": { "url": "http://storage.localhost:8001" },
  "hosting": { "url": "http://hosting.localhost:8002" },
  "email": { "url": "http://email.localhost:8003" }
}
```

Create the superuser and the company first. Sign in on the shell as that staff user or as a company owner, then open `/admin`. The shell loads `https://admin.shellui.com` in an iframe. That page calls your identity, storage, hosting, and email URLs with the shell access token.

These defaults already allow that origin:

- `IDENTITY_CSRF_TRUSTED_ORIGINS`, `STORAGE_CSRF_TRUSTED_ORIGINS`, `HOSTING_CSRF_TRUSTED_ORIGINS`, and `EMAIL_CSRF_TRUSTED_ORIGINS` include `https://admin.shellui.com`. A set CSRF list replaces the image default, so do not drop that origin.
- `IDENTITY_CORS_ALLOWED_ORIGINS`, `STORAGE_CORS_ALLOWED_ORIGINS`, `HOSTING_CORS_ALLOWED_ORIGINS`, and `EMAIL_CORS_ALLOWED_ORIGINS` include `https://admin.shellui.com`. Those values are appended to each image list. Identity, storage, and hosting also set `CORS_ALLOW_ALL_ORIGINS=true`. Email leaves allow-all off, so its allowed-origins list is what the browser uses.
- `CORS_ALLOW_PRIVATE_NETWORK=true` on storage, hosting, and email. A page on `https://admin.shellui.com` that calls `http://*.localhost` sends a private-network preflight. Storage, hosting, and email answer it. identity-service 0.7.0 does not read `CORS_ALLOW_PRIVATE_NETWORK`, so the response has no private-network header. The browser blocks those identity calls while identity stays on `http://*.localhost`. A public HTTPS identity URL is not a private-network target, so the browser does not send that preflight.

The OAuth redirect allowlist is the shell origin, not the admin origin. Login returns to the shell (`/login/callback`). After you create the company, add that shell origin (for example `http://localhost:4000`) under Identity, OAuth apps, or with `POST /api/v1/oauth-redirects`. `https://admin.shellui.com` is not a login callback.

## Create the first superuser

`createsuperuser` is what sets `is_staff` and `is_superuser`. Leave `SETUP_TOKEN` empty so the public setup form stays closed.

```bash
docker compose exec identity python manage.py createsuperuser
```

Sign in at `http://identity.localhost:8000/admin/` and add a company under Companies. The first company id is usually `1`. That id is `backend.companyId` in the shell config.

## How the services connect

Each service has a web container and a worker container. The web container runs migrations, then gunicorn on port `8000`. The worker runs Celery with beat in the same process. Beat is not a separate container. The web process has the scheduler off so jobs are not run twice.

One Postgres 16 server holds four databases (`identity`, `storage`, `hosting`, `email`), each with its own role. The init script runs only when the data volume is created. One Redis 8 server is shared. Each service uses its own Redis database index: identity `0`, storage `1`, hosting `2`, email `3`.

identity signs RS256 tokens. `generate-secrets.sh` writes the public JWKS to `deploy/secrets/jwks.json`, and Compose mounts that file into storage, hosting, and email. identity publishes the same document at `/.well-known/jwks.json`. Callers inside the Compose network use `http://identity:8000` and `http://email:8000`. Those Docker DNS names are on `ALLOWED_HOSTS`, because Django rejects a Host header that is not listed.

`bootstrap.sh` asks email-service for one `esk_` key per caller and restarts identity, storage, and hosting so they pick the key up. The plaintext key is stored only in `.env`.

`DEBUG` is `false`. `EMAIL_FALLBACK_PROVIDER` is `none`, so mail is not sent until you set `resend` or `smtp` and the matching credentials. `SECURE_SSL_REDIRECT` is `false` so HTTP health checks work on this proxy-free install. Turn `SESSION_COOKIE_SECURE` and `CSRF_COOKIE_SECURE` on when a proxy terminates TLS. The Coolify template does that.

Until `EMAIL_SERVICE_API_KEY` is set, identity does not call email-service. With `DEBUG=false` it uses Django's SMTP backend. The image default is host `localhost` and port `25`, so the identity log shows connection errors. That noise stops after `bootstrap.sh` writes the key.

email-service 0.2.0 uses the same variables. `EMAIL_AUTH_LINK_HOSTS` is the platform list for every company. A company adds hostnames with `PUT /api/v1/auth-link-hosts` or Allowed link hosts in Django admin, and hosts of its identity application URLs are included when identity returns them. A host outside that union is refused. Lane workers write a heartbeat, and a lane is stale after 60 seconds. That interval is not an env var. Staff read scheduler and lane health at `GET /api/v1/scheduled-jobs`. `SCHEDULER_ENABLED` and `EMAIL_WORKERS_ENABLED` still decide whether beat and the lane workers run.

## Shell config

`deploy/shell.example.json` sets `backend.adminUrl` to `https://admin.shellui.com`. `filesUrl` stays a local dev server because files has no published image. Create the company before you rely on `companyId`.

Sign-in by magic link fails with `provider_not_configured` until email-service has a provider. Set `EMAIL_FALLBACK_PROVIDER` to `resend` or `smtp` and the matching credentials. The message is not queued. OAuth providers are unset until you add credentials in Django admin. `deploy/shell.example.json` lists `password` and `magic_link`. Password sign-in works without a mail provider. Magic link does not.

## Upgrade

Change the image tags in `.env`, then run:

```bash
docker compose up -d
```

Web containers migrate on start. The Postgres init script does not run again, so a later password change in `.env` does not alter an existing role. Replacing `EMAIL_CREDENTIALS_KEY` or `EMAIL_VARIABLES_KEY` makes stored provider credentials unreadable. To rotate the signing key, copy the current `JWT_PUBLIC_KEY` and `JWT_KEY_ID` into `JWT_PREVIOUS_PUBLIC_KEY` and `JWT_PREVIOUS_KEY_ID`. Replace `JWT_PRIVATE_KEY`, or clear it. Then run `./scripts/generate-secrets.sh`. The script writes a new public key and key id from the private key. `deploy/secrets/jwks.json` keeps the previous public key.

## Backup

Stop the stack, then keep the named volumes `postgres-data`, `redis-data`, `identity-data`, `storage-data`, `hosting-data`, and `email-data` together with `deploy/.env` and `deploy/secrets/jwks.json`. Restoring the volumes without those two files leaves the services unable to read tokens, Fernet ciphertext, or the pinned JWKS.

## Variables

`deploy/.env.example` is the full list, grouped by service, with the image tags and the safe defaults. Generate these before the first start:

- `POSTGRES_PASSWORD` and the four database role passwords
- `IDENTITY_DATABASE_URL`, `STORAGE_DATABASE_URL`, `HOSTING_DATABASE_URL`, `EMAIL_DATABASE_URL`
- `IDENTITY_SECRET_KEY`, `STORAGE_SECRET_KEY`, `HOSTING_SECRET_KEY`, `EMAIL_SECRET_KEY`
- `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_KEY_ID`, and `IDENTITY_JWKS`
- `EMAIL_CREDENTIALS_KEY`, `EMAIL_VARIABLES_KEY`, and `EMAIL_HASH_PEPPER`

`./scripts/generate-secrets.sh` fills every empty generated value and does not replace a value you already set. It does rewrite `JWT_PUBLIC_KEY`, `JWT_KEY_ID`, and `IDENTITY_JWKS` from `JWT_PRIVATE_KEY`. A set `JWT_PREVIOUS_PUBLIC_KEY` stays in that JWKS. `./scripts/bootstrap.sh` fills `EMAIL_SERVICE_API_KEY_IDENTITY`, `EMAIL_SERVICE_API_KEY_STORAGE`, and `EMAIL_SERVICE_API_KEY_HOSTING`. There is no default password. A one-off Fernet key is `python3 -c "import base64,os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"`.

Pinned image tags in the example file:

- `shellui/identity-service:0.7.0`
- `shellui/storage-service:0.5.0`
- `shellui/hosting-service:0.6.1`
- `shellui/email-service:0.2.0`
- `postgres:16.15-alpine`
- `redis:8.2-alpine`

Override `*_IMAGE` to move a pin. These repositories are not published to GHCR.

## Coolify

`deploy/coolify/docker-compose.yml` is a Docker Compose Empty template. It has no host ports, no container names, and no restart policy. Coolify adds the proxy. Each public service declares `SERVICE_URL_IDENTITY_8000`, `SERVICE_URL_STORAGE_8000`, `SERVICE_URL_HOSTING_8000`, or `SERVICE_URL_EMAIL_8000` once, so Coolify knows the container port. Settings then use `SERVICE_URL_IDENTITY` and `SERVICE_FQDN_IDENTITY` (and the storage, hosting, and email names) with no port suffix. Workers, Postgres, and Redis stay private.

Coolify shows a variable in the UI only when the template sets it. A name that is missing from the template cannot be set there. It stays at the image default.

`TRUSTED_PROXY_IPS` defaults to `172.16.0.0/12` and is passed to identity and hosting. That is the Docker bridge range, so the Coolify proxy can set `X-Forwarded-For`.

The Postgres init script reads role passwords with `printenv`. It has no brace variables, so Coolify substitution cannot blank them. This repository does not run Coolify. Confirm the first database init with a live Coolify deploy.

Coolify generates `SERVICE_USER_*`, `SERVICE_PASSWORD_64_*`, and `SERVICE_REALBASE64_32_*` values (database passwords, Django secret keys, both Fernet keys, and the hash pepper). It cannot generate an RSA private key. Before you deploy, run `./scripts/generate-secrets.sh` on a trusted machine and paste:

- `JWT_PRIVATE_KEY`, the one-line PEM (`\n` between lines is accepted)
- `IDENTITY_JWKS`, the one-line public JSON

`EMAIL_FALLBACK_PROVIDER` stays `none`. `DEBUG` stays `false`. `SECURE_SSL_REDIRECT` stays `false` so in-container HTTP health checks succeed while the proxy terminates TLS. Cookie secure flags and HSTS are on.

After the first healthy deploy, open a terminal on the email container and create the caller keys:

```bash
python manage.py create_service_key \
  --service identity \
  --lanes auth,transactional \
  --prefixes identity.
python manage.py create_service_key \
  --service storage \
  --lanes transactional \
  --prefixes storage.
python manage.py create_service_key \
  --service hosting \
  --lanes transactional \
  --prefixes hosting.
```

Paste each printed `esk_` value into `EMAIL_SERVICE_API_KEY_IDENTITY`, `EMAIL_SERVICE_API_KEY_STORAGE`, or `EMAIL_SERVICE_API_KEY_HOSTING`, then restart those three services and their workers. Create the superuser from the identity container with `python manage.py createsuperuser`.

Hosted apps need DNS for `HOSTING_APP_DOMAIN` (`{slug}.shellui.local` unless you change it). This template does not create that DNS.

Submitting the template upstream is a later step. Coolify accepts a one-click service only when the repository has at least 1,000 GitHub stars. Until then, deploy with Docker Compose Empty. When the repository qualifies, open a pull request against the Coolify `next` branch with `templates/compose/shellui.yaml` and `public/svgs/shellui.svg` (`# logo: svgs/shellui.svg`), and a docs pull request that adds `content/docs/services/shellui.mdx`. Test that file through Docker Compose Empty before opening the pull request.

## Not in this stack

- No admin container. Use [https://admin.shellui.com](https://admin.shellui.com). An embedded admin may come later.
- No published image for the shell or for files (`shellui/files`).
- No wildcard DNS for apps deployed through hosting-service.
- No mail provider. Magic-link sign-in returns `provider_not_configured` until you set `resend` or `smtp`.
- No GHCR images. Pins are Docker Hub tags.
