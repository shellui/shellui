# Shellui local dev stack

Everything for the local Docker stack lives in this directory.

```bash
./start.sh
```

This creates `.env.local` on first run (later runs append any new variables), then starts the full stack. Extra arguments go to Docker Compose, for example `./start.sh -d`.

Setup, URLs, common commands and troubleshooting: [docs/dev-stack.md](../docs/dev-stack.md).

## Files

| File                         | Role                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `container/`                 | Dev-only entrypoints and local `@shellui/*` link                                |
| `docker-compose.yml`         | Full stack                                                                      |
| `.env.local.example`         | Committed env template                                                          |
| `.env.local`                 | Generated secrets (gitignored)                                                  |
| `start.sh`                   | Generate or update `.env.local`, then compose up                                |
| `generate-env.sh`            | Creates or updates `.env.local` from the example, including dev-only RS256 keys |
| `generate_env.py`            | Secret generator (stdlib and OpenSSL)                                           |
| `config/`                    | Shell dev config (split files) for `shell`                                      |
| `postgres/init-databases.sh` | One Postgres database per backend                                               |
