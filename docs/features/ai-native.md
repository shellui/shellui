---
title: AI native platform (global SaaS MCP, regional gateway, human CLI)
sidebar_label: AI native platform
description: Developer map for global SaaS MCP, ai gateway, regional services, CLI, and SDK on the local stack.
---

Use each service `docs/mcp.md` on `develop`, `GET /api/schema/` on that host, and `tools/list` for exact tool names and request bodies. This page stays in the Shellui repo; service handbooks own the full contracts. End-to-end MCP client coverage is described in service CI and handbooks; treat your own stack run as the proof for a given machine.

## Local developer surfaces

After [dev stack](/dev-stack) `./start.sh`, browser apps and APIs use `PUBLIC_*` URLs from `dev/.env.local.example`: shell 4000, identity 8001, storage 8002, hosting 8003, email 8004, saas 8005, ai 8006, admin 5173, dashboard 5174, files 5175, playground 5176. Multi-region dashboard env vars `REGION_LOCAL_*_ORIGIN` map the region code `local` to those origins. `SHELL_IDENTITY_COMPANY_ID` and `DASHBOARD_IDENTITY_COMPANY_ID` default to `1` to match the seeded company; they are configuration, not a runtime assertion that id `0` equals id `0` across services.

## Global agent signing (dev)

`dev/.env.local.example` defines `GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE` (for example `shellui_global_agent_dev`), `GLOBAL_JWKS`, `GLOBAL_AGENT_PRIVATE_KEY`, and `GLOBAL_AGENT_KEY_ID`. `dev/generate_env.py` generates the key material; `./generate-env.sh` writes `dev/.env.local`. Never commit `.env.local`. Manual rotation: generate a PEM with OpenSSL, build a one-key JWKS whose `kid` matches `GLOBAL_AGENT_KEY_ID`, set `GLOBAL_JWKS` (quoted like the generator), and set `GLOBAL_AGENT_PRIVATE_KEY` with newlines as `\n`. Identity receives `GLOBAL_ISSUER_URL` (`PUBLIC_SAAS_URL`), `GLOBAL_JWKS`, and `GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE` from compose. The **saas** container receives the same three global-agent variables from `dev/docker-compose.yml` so minted tokens match identity verification.

## Compose notes (this repo)

- **ai-service:** `AI_PUBLIC_URL` is `PUBLIC_AI_URL` so MCP resource URLs match the browser origin ([ai-service MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)). Internal service URLs stay `http://storage:8000`, `http://hosting:8000`, `http://email:8000`, `http://saas:8000`.
- This compose file does **not** mount the host Docker socket and does not set `DOCKER_ALLOWED_SOCK`. Plugins that need a socket are configured in the sibling service repo, not here.
- Do **not** enable insecure options such as `credential_plaintext` outside a dedicated test harness.

## References (stable links)

- Global SaaS MCP: [saas-service docs/mcp.md](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md) on `develop` (404 from here means the repo or path differs on your clone; open the same path in your checkout).
- Gateway and downstream tool names `service_tool`: [ai-service MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md).
- Identity OAuth and agents: [identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md).
- SaaS dashboard HTTP paths used by the CLI: [packages/cli/README.md](https://github.com/shellui/shellui/blob/develop/packages/cli/README.md) and [saas-paths.js](https://github.com/shellui/shellui/blob/develop/packages/cli/src/http/saas-paths.js).

## Regions and endpoints (human session, not MCP guesswork)

With `shellui login`, the CLI calls the SaaS host (`saas.url` or `SHELLUI_SAAS_URL`, dev default `http://localhost:8005`) with a **human** Bearer session (see [packages/cli/README.md](https://github.com/shellui/shellui/blob/develop/packages/cli/README.md)):

- `GET …/api/v1/regions/` — `shellui projects regions`
- `GET …/api/v1/companies/` — `shellui projects list`
- `GET …/api/v1/companies/{uuid}/endpoints/` — `shellui projects endpoints` or `shellui projects endpoints {uuid}`

The JSON body for `endpoints` is defined in saas-service OpenAPI (`GET http://localhost:8005/api/schema/` on your stack). It lists each configured service for that dashboard company (keys such as `identity`, `storage`, `hosting`, `email`, `ai`, and related link fields—copy names from the live response; there is no separate `ai_base` key in that object). Use that response to map a region code to the origins your browser and agents should call.

## Token lifetime

OAuth access token TTL and agent token lifetime come from **identity-service** settings and the token response (`expires_in` where present). Do not assume a fixed 60 second cap in docs; read the response from your provider and the identity handbook.

## Global SaaS MCP versus regional service MCP

- **Global control plane:** `POST http://localhost:8005/mcp` on saas-service after the OAuth and consent flow in [saas-service docs/mcp.md](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md).
- **Regional services:** `POST http://localhost:8002/mcp`, `8003/mcp`, `8004/mcp` expect an identity-issued agent JWT whose `aud` is that service’s `/mcp` URL ([storage](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md), [hosting](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md), [email](https://github.com/shellui/email-service/blob/develop/docs/mcp.md)).
- **AI gateway:** `POST http://localhost:8006/c/1/mcp` (replace `1` with your regional decimal tenant) issues downstream calls with tokens identity mints for each service ([ai-service MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)).

Do **not** assume a single global SaaS-issued JWT can call regional `POST /mcp` on storage, hosting, or email without the exchange or gateway flow identity describes for that deployment. Narrow your test to one stack and verify `aud` and `tools/list` before relying on it.

## Human consent on SaaS (no secret in the doc)

Complete sign-in and Terms in the shell, obtain an identity access token with your client, then:

```bash
export HUMAN_ACCESS_TOKEN="paste token here"
```

Use that value in `Authorization` headers from your shell only; do not paste tokens into issue threads or commits.

Global MCP uses `POST http://localhost:8005/mcp` after OAuth as described in [saas-service docs/mcp.md](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md) and [identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md).

## Walkthrough: global SaaS `tools/list` and `tools/call`

Use real tool names from `tools/list`. After the agent OAuth exchange, export the agent access token in your shell (never commit it), for example as `AGENT_ACCESS_TOKEN`.

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
    data = json.dumps(payload).encode()
    hdr = {"Content-Type": "application/json",
           "Authorization": "Bearer %s" % token}
    req = urllib.request.Request(url, data=data, headers=hdr, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)
```

For a dashboard company record, use the operation id and arguments from `tools/list` and `GET http://localhost:8005/api/schema/`, not a guessed name.

## Walkthrough: regional gateway

Same JSON-RPC methods on `POST http://localhost:8006/c/1/mcp` with a token whose `aud` is that URL and whose `company_id` matches the path segment ([ai-service MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)). Downstream tools are named `service_tool` in `tools/list`.

## OpenAPI: hosting (verified operation ids from handbook)

From [hosting-service docs/mcp.md](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md) (deploy sequence):

1. `hosting_v1_apps_list` or `hosting_v1_apps_retrieve`
2. `hosting_v1_apps_deployments_create` with `app_version` and `shellui_version`
3. `hosting_v1_apps_deployments_artifact_upload_url_create`
4. HTTP `PUT` of the archive to the returned URL (not via MCP)
5. `hosting_v1_apps_deployments_artifact_upload_complete_create`
6. `hosting_v1_apps_deployments_finalize_create`

Read-only example path from the same doc: `GET /hosting/v1/apps/{app_ref}/logs/requests` with query `cursor` and `limit` — map to the tool id from `tools/list` on your build.

## OpenAPI: email (verified paths from handbook)

From [email-service docs/mcp.md](https://github.com/shellui/email-service/blob/develop/docs/mcp.md): `GET /api/v1/templates`, `POST /api/v1/templates/{template_id}/render-preview`, etc. The handbook gives this `tools/call` shape (tool name must match `tools/list` on your deployment):

```json
{
  "name": "api_v1_templates_render_preview",
  "arguments": {
    "path": "/api/v1/templates/{template_id}/render-preview",
    "path_params": { "template_id": "12" },
    "method": "POST",
    "body": { "variables": { "company_name": "Acme" } }
  }
}
```

Agent JWT: `aud` must equal `{EMAIL_PUBLIC_URL}/mcp` and `scope` must include `email` ([email-service docs/mcp.md](https://github.com/shellui/email-service/blob/develop/docs/mcp.md)).

## Recipe pointers

- Storage: [storage-service docs/mcp.md](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md), [buckets and objects](https://github.com/shellui/storage-service/blob/develop/docs/buckets-and-objects.md).
- Hosting: [hosting-service docs/mcp.md](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md).
- Email: [email-service docs/mcp.md](https://github.com/shellui/email-service/blob/develop/docs/mcp.md).

Human CLI (session channel): `node packages/cli/bin/shellui.js storage buckets list`, `hosting apps list`, `projects regions`, `projects endpoints` ([CLI](/cli)). Iframe storage: [SDK](/sdk).

## Smoke

```bash
node packages/cli/bin/shellui.js login
node packages/cli/bin/shellui.js companies get 1
node packages/cli/bin/shellui.js projects list
node packages/cli/bin/shellui.js projects regions
node packages/cli/bin/shellui.js storage buckets list
node packages/cli/bin/shellui.js hosting apps list
```

## Related

- [Authentication](/features/authentication)
- [CLI](/cli)
- [SDK](/sdk)
- [Local dev stack](/dev-stack)
