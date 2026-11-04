# Shellui local dev stack

Everything for the local Docker stack lives in this directory.

```bash
./start.sh
```

This creates `.env.local` on first run, then starts the full stack. Extra arguments go to Docker Compose, for example `./start.sh -d`.

Setup, URLs, common commands and troubleshooting: [docs/dev-stack.md](../docs/dev-stack.md).

## Files

| File                         | Role                                             |
| ---------------------------- | ------------------------------------------------ |
| `docker-compose.yml`         | Full stack                                       |
| `.env.local.example`         | Committed env template                           |
| `.env.local`                 | Generated secrets (gitignored)                   |
| `start.sh`                   | Generate `.env.local` if needed, then compose up |
| `generate-env.sh`            | Creates `.env.local` from the example            |
| `generate_env.py`            | Secret generator (stdlib and OpenSSL)            |
| `shellui.config.json`        | Shell dev config for the `shell` service         |
| `postgres/init-databases.sh` | One Postgres database per backend                |
