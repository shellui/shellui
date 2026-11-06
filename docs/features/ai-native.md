---
title: AI native platform (global SaaS MCP, regional gateway, human CLI)
sidebar_label: AI native platform
description: Developer map for global SaaS MCP, ai gateway, regional services, CLI, and SDK on the local stack.
---

Use each service `docs/mcp.md` on `develop`, `GET /api/schema/` on that host, and `tools/list` for exact tool names. This page stays in the Shellui repo; service handbooks own the full contracts.

## Local developer surfaces

After [dev stack](/dev-stack) `./start.sh`, browser apps and APIs use `PUBLIC_*` URLs from `dev/.env.local.example`: shell 4000, identity 8001, storage 8002, hosting 8003, email 8004, saas 8005, ai 8006, admin 5173, dashboard 5174, files 5175, playground 5176. Multi-region dashboard env vars `REGION_LOCAL_*_ORIGIN` map the code `local` to those origins. `SHELL_IDENTITY_COMPANY_ID` and `DASHBOARD_IDENTITY_COMPANY_ID` default to `1`; identity seed creates company 1—they are not “strict 0 == 0” semantics, they are the configured tenant for the stack.

## Global agent signing (dev)

`dev/.env.local.example` holds the full set: `GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE` (for example `shellui_global_agent_dev`), `GLOBAL_JWKS` (public JWKS JSON for identity), and `GLOBAL_AGENT_PRIVATE_KEY` plus `GLOBAL_AGENT_KEY_ID` for saas-service. `dev/generate_env.py` generates the RSA material and PEM-in-one-line form; `./generate-env.sh` fills `dev/.env.local`. Never commit `.env.local`. To rotate by hand without Python: `openssl genrsa -out saas-global-agent.pem 2048`, derive a public PEM, build a one-key JWKS with the same `kid` you set in `GLOBAL_AGENT_KEY_ID`, put the JWKS string in `GLOBAL_JWKS` (quoted like the generator does), and set `GLOBAL_AGENT_PRIVATE_KEY` to the PEM with newlines as `\n`. Identity reads `GLOBAL_ISSUER_URL` (`PUBLIC_SAAS_URL`), `GLOBAL_JWKS`, and `GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE` from compose. The **saas** service receives `GLOBAL_AGENT_PRIVATE_KEY`, `GLOBAL_AGENT_KEY_ID`, and `GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE` from `dev/docker-compose.yml` so minted tokens match what identity verifies.

## Compose wiring called out here

- **ai-service:** gets `AI_PUBLIC_URL` (`PUBLIC_AI_URL`) so MCP resource URLs match the public origin ([ai-service MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)). Internal upstream URLs stay `http://storage:8000`, `http://hosting:8000`, `http://email:8000`, `http://saas:8000`. This repo’s compose does **not** mount the host Docker socket and does not set `DOCKER_ALLOWED_SOCK`; socket plugins belong to ai-service or storage-service configuration in those repos, not this file.
- **saas-service:** global agent signing env is passed as above; extend compose only when your `saas-service` revision documents extra keys.
- **shell** and **front-ends:** unchanged; see [dev stack](/dev-stack).

Do **not** enable insecure runtime options such as `credential_plaintext` in production; follow each service’s security docs.

## Authoritative references

- Identity open work: [PR 135](https://github.com/shellui/identity-service/pull/135).
- Shellui CLI SaaS paths: [PR 184](https://github.com/shellui/shellui/pull/184) (`api/v1` mount, no extra `saas/` segment—[saas-paths.js](https://github.com/shellui/shellui/blob/develop/packages/cli/src/http/saas-paths.js)).
- Global SaaS MCP: [saas-service docs/mcp.md](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md) on `develop`.
- Gateway tool naming: downstream tools appear as `service_tool` ([ai-service MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)).

## IDs and routing

- **Regional tenant:** decimal `company_id` in the identity JWT (seed uses `1`). AI gateway URL: `POST http://localhost:8006/c/1/mcp` with the same digit in the path ([ai-service MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)).
- **Dashboard company:** UUID from `shellui projects list` on the SaaS host; `regional_company_id` on that record links back to the decimal tenant. CLI code paths use `api/v1/companies/` and related routes ([saas-paths.js](https://github.com/shellui/shellui/blob/develop/packages/cli/src/http/saas-paths.js)).

## Human consent on SaaS (no inline Bearer in examples)

Sign in through the shell, finish Terms if prompted, then obtain a normal identity access token the way your client already does (browser session or device code). Export it in your shell and reuse it in requests:

```bash
export HUMAN_ACCESS_TOKEN="paste token here"
```

Global MCP uses `POST http://localhost:8005/mcp` after OAuth consent described in [saas-service docs/mcp.md](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md) and [identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md). The Shellui dashboard relies on a trusted POST to complete consent; a generic `GET`-only MCP client cannot complete that step without the same session context ([saas-service docs/mcp.md](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md)).

## Walkthrough: list tools then call (global SaaS)

Use the exact JSON-RPC envelope and tool names from `tools/list` and OpenAPI on your revision. Below assumes HTTP Streamable MCP and Bearer minted for the agent after OAuth; substitute the real tool name for companies create.

Export an agent token (after OAuth exchange) as `AGENT_ACCESS_TOKEN`.

```bash
curl -sS -X POST http://localhost:8005/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AGENT_ACCESS_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

```bash
BODY='{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{'
BODY="$BODY\"name\":\"PASTE_FROM_TOOLS_LIST\",\"arguments\":{}}}"
curl -sS -X POST http://localhost:8005/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AGENT_ACCESS_TOKEN" \
  -d "$BODY"
```

```python
import json, urllib.request

def mcp(url, token, payload):
    hdr = {"Content-Type": "application/json",
           "Authorization": "Bearer %s" % token}
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(), headers=hdr, method="POST"
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)
```

Resolve `api_v1_companies_retrieve` (or equivalent) from `tools/list`; path parameters and body must match `GET http://localhost:8005/api/schema/`. Pending creates return `approval_id` for a human decision on SaaS ([saas-service docs/mcp.md](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md)).

## Walkthrough: regional gateway

Use the same JSON-RPC methods on `POST http://localhost:8006/c/1/mcp` with a token whose `aud` is that URL and `company_id` matches the path ([ai-service MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)). Tool names look like `storage_list_buckets` or `saas_list_projects`—copy the string from `tools/list`, do not invent prefixes.

## Recipe: storage (handbook)

[storage-service docs/mcp.md](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md), [buckets and objects](https://github.com/shellui/storage-service/blob/develop/docs/buckets-and-objects.md). Company bucket, connectors, objects: paths and MCP tools come from OpenAPI. Human CLI: `node packages/cli/bin/shellui.js storage buckets list` ([CLI](/cli)). Iframe: [SDK](/sdk).

## Recipe: hosting (handbook)

[hosting-service docs/mcp.md](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md). Deploy uses MCP tools for metadata, then **HTTPS PUT** of the archive outside JSON-RPC, then finalize ([hosting MCP deploy](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md)). Human CLI: `node packages/cli/bin/shellui.js hosting apps list`.

## Recipe: email (handbook)

[email-service docs/mcp.md](https://github.com/shellui/email-service/blob/develop/docs/mcp.md). Agent `aud` must be `{EMAIL_PUBLIC_URL}/mcp`. Example normalized `tools/call` shape lives in that file.

## CLI commands that matter here

Run `node packages/cli/bin/shellui.js --help` from the monorepo (or `shellui --help` when the package is on `PATH`). Focus on `login`, `auth status`, `companies`, `projects`, `storage buckets`, `hosting apps`, `hosting deployments`, `deploy`. `projects create` is not implemented ([projects.js](https://github.com/shellui/shellui/blob/develop/packages/cli/src/commands/projects.js)).

## Smoke

```bash
node packages/cli/bin/shellui.js login
node packages/cli/bin/shellui.js companies get 1
node packages/cli/bin/shellui.js projects list
node packages/cli/bin/shellui.js storage buckets list
node packages/cli/bin/shellui.js hosting apps list
```

## Related

- [Authentication](/features/authentication)
- [CLI](/cli)
- [SDK](/sdk)
- [Local dev stack](/dev-stack)
- [Identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)
