# Shellui local dev stack

Everything for the local Docker stack lives in this directory.

```bash
./start.sh
```

This creates `.env.local` on first run (later runs append any new variables), then starts the full stack, including regional identity and identity-global, regional ai (`:8006`) and ai-global (`:8008`), and Jaeger. Extra arguments go to Docker Compose, for example `./start.sh -d`.

Setup, URLs, common commands and troubleshooting: [docs/dev-stack.md](../docs/dev-stack.md).

Optional tuning in `.env.local`: `DEV_FILE_WATCH_POLLING=true` if Vite misses file changes on macOS; `DJANGO_STATRELOAD_SLEEP` and `EMAIL_LANE_WORKER_POLL_SECONDS` trade idle CPU for reload latency.

## Traces

`./start.sh` starts Jaeger all-in-one with the rest of the stack. Open the trace UI at http://localhost:16686. Traces stay in memory until that container stops.

Services export when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. The generated `.env.local` sets it to `http://jaeger:4318` (OpenTelemetry Protocol (OTLP) over HTTP, on the Compose network). `OTEL_EXPORTER_OTLP_PROTOCOL` is `http/protobuf`. `OTEL_RESOURCE_ATTRIBUTES` sets `deployment.environment` to `dev` and `cloud.region` to `DEV_REGION_CODE`.

Compose maps one generated name to `OTEL_SERVICE_NAME` on each process:

- **identity**: `shellui-identity`
- **identity-global**: `shellui-identity-global`
- **email**: `shellui-email`
- **email-worker**: `shellui-email-worker`
- **storage**: `shellui-storage`
- **hosting**: `shellui-hosting`
- **saas**: `shellui-saas`
- **ai**: `shellui-ai`
- **ai-global**: `shellui-ai-global`

To use another collector, set `OTEL_EXPORTER_OTLP_ENDPOINT` in `.env.local` to that collector's OTLP/HTTP base URL. The exporter adds `/v1/traces`. Keep `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`. Set `OTEL_EXPORTER_OTLP_HEADERS` when the collector requires a header.

The same variables work with any OTLP/HTTP collector. Run `./start.sh` again after you save the file. Clear `OTEL_EXPORTER_OTLP_ENDPOINT` to stop export. Jaeger still starts, because `./start.sh` takes no extra options.

## Files

| File                         | Role                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `container/`                 | Dev-only entrypoints and local `@shellui/*` link                                |
| `docker-compose.yml`         | Full stack                                                                      |
| `.env.local.example`         | Committed env template                                                          |
| `.env.local`                 | Generated secrets (gitignored)                                                  |
| `start.sh`                   | Generate or update `.env.local`, create missing databases, then compose up      |
| `generate-env.sh`            | Creates or updates `.env.local` from the example, including dev-only RS256 keys |
| `generate_env.py`            | Secret generator (stdlib and OpenSSL)                                           |
| `config/`                    | Shell dev config (split files) for `shell`                                      |
| `postgres/init-databases.sh` | Creates each missing backend database on every start                            |
