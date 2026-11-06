---
title: AI native platform (global SaaS MCP, regional gateway, human CLI)
sidebar_label: AI native platform
description: Practical map for global SaaS MCP, regional services, AI gateway, human CLI, and dev stack wiring.
---

This guide is self-contained: use it with your local or staging stack and the service handbooks on `develop`. Discover tool names with `tools/list` on each MCP host; counts change as services ship new operations.

## Choose your surface

| Surface              | Who signs in                                | Typical entry                                                                                   | Where contracts live                                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Global SaaS MCP      | Agent OAuth after human consent             | `POST https://your-saas/mcp`                                                                    | [saas-service docs/mcp.md](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md) (open in org clone if raw 404)                                                                                                                |
| Regional service MCP | Agent JWT (`aud` = that service `/mcp`)     | `POST …:8002/mcp`, `8003/mcp`, `8004/mcp`                                                       | [Storage](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md), [Hosting](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md), [Email](https://github.com/shellui/email-service/blob/develop/docs/mcp.md) |
| AI gateway MCP       | Agent JWT (`aud` = per-company gateway URL) | `POST {PUBLIC_AI_URL}/c/{regional_id}/mcp`                                                      | [ai-service MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)                                                                                                                                                   |
| Human CLI            | Same person as `shellui login`              | `shellui companies`, `shellui projects`, `shellui storage`, `shellui hosting`, `shellui deploy` | [CLI reference](/cli), [packages/cli/README.md](https://github.com/shellui/shellui/blob/develop/packages/cli/README.md)                                                                                                                    |
| iframe SDK           | Human browser session in shell              | `shellui.init()`, `shellui.storage…`                                                            | [SDK](/sdk)                                                                                                                                                                                                                                |

Identity remains the OAuth authorization server for MCP clients. Align identity releases with whatever the other handbooks assume.

## SaaS project endpoints and MCP URLs

`GET {saas}/api/v1/companies/{dashboard_uuid}/endpoints/` is how the CLI implements `shellui projects endpoints` ([CLI reference](/cli)). The serializer **`project_mcp_endpoints`** exposes an `mcp` object with **only** these resource URLs: `identity`, `storage`, `hosting`, `email`. It does **not** include `ai` or `ai_base`.

For the AI gateway base, use local env from `dev/.env.local.example`: **`PUBLIC_AI_URL`** and **`REGION_LOCAL_AI_ORIGIN`** (same value in the default dev stack). Do not infer an AI origin from the endpoints payload.

`mcp.*` values are **MCP resource** URLs (they end in `/mcp` where that service exposes MCP). OAuth **authorization server** metadata is requested from the paths each service handbook names (for example `GET /.well-known/oauth-authorization-server` on the host that issues browser or client tokens). Do not strip `/mcp` and treat the remainder as an auth server URL without checking that handbook.

## Region codes

`shellui projects regions` returns the regions your dashboard knows. **`DEV_REGION_CODE`** in dev is lowercase `local`. Only use a `region` slug that appears in that list; the handbooks and OpenAPI define valid codes.

## Regional id versus dashboard UUID

| Identifier        | Shape                     | CLI                                                    |
| ----------------- | ------------------------- | ------------------------------------------------------ |
| Regional tenant   | Decimal, JWT `company_id` | `shellui companies list`, `shellui companies get 1`    |
| Dashboard company | UUID                      | `shellui projects list`, `shellui projects get {uuid}` |

SaaS company rows can include **`regional_company_id`** when provisioned. To require it before regional calls:

```bash
node packages/cli/bin/shellui.js projects get "$DASHBOARD_UUID" --json \
  | jq -e '(.regional_company_id | type) as $t
    | ($t == "string" or $t == "number")
    and ((.regional_company_id | tostring | length) > 0)'
```

Then:

```bash
export REGIONAL_COMPANY_ID="$(
  node packages/cli/bin/shellui.js projects get "$DASHBOARD_UUID" --json \
    | jq -r '.regional_company_id | tostring'
)"
```

Use that value in the AI gateway path `…/c/${REGIONAL_COMPANY_ID}/mcp`.

## Global agent JWKS and signing (dev stack)

`dev/.env.local.example` defines **`GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`**, **`GLOBAL_JWKS`**, **`GLOBAL_AGENT_PRIVATE_KEY`**, **`GLOBAL_AGENT_KEY_ID`**. Identity receives `GLOBAL_ISSUER_URL`, `GLOBAL_JWKS`, and `GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`. The **saas** service receives the private key and key id from `dev/docker-compose.yml` so minted tokens verify against identity’s JWKS.

**Preferred:** from `shellui/dev` run `./generate-env.sh` (see [dev stack](/dev-stack)). That invokes [`dev/generate_env.py`](https://github.com/shellui/shellui/blob/develop/dev/generate_env.py), which uses **OpenSSL** for RSA key material and **Python `cryptography`** to build a one-key JWKS (`jwks_for_rsa_public_pem`).

**Regenerate without guessing PEM math:** rerun `./generate-env.sh`; it appends any new keys from the example file and keeps existing secrets. Never commit **`dev/.env.local`**.

**Optional, container with repo mounted** (same Python deps as saas image may not include `cryptography`; prefer host `python3` with `cryptography` installed, or reuse the generator script):

```bash
cd path/to/shellui/dev
python3 ./generate_env.py .env.local.example /tmp/sample.env
grep '^GLOBAL_JWKS=' /tmp/sample.env
rm /tmp/sample.env
```

For **AI service** signing (gateway delegation to identity), the handbook documents **`python manage.py generate_signing_key`** in the ai-service repo ([ai-service MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)), not the Shellui `generate_env.py`.

## Local URLs (compose)

From `dev/.env.local.example`: shell `4000`, identity `8001`, storage `8002`, hosting `8003`, email `8004`, saas `8005`, ai `8006`. **`AI_PUBLIC_URL`** in compose matches **`PUBLIC_AI_URL`** so gateway resource metadata uses the browser-facing origin.

This repo’s `dev/docker-compose.yml` does **not** mount the host Docker socket. **`credential_plaintext`** and similar unsafe flags stay off outside isolated tests.

## Human web flow (Terms, non-staff, CORS)

Use a **normal member** account (not staff) in the shell at **`PUBLIC_SHELL_URL`**. Complete **Terms of Service** in the product before saving agent consent; the shell does not auto-accept legal text for you. Check session without printing secrets: `shellui auth status`.

**CORS:** `SAAS_CORS_ALLOWED_ORIGINS` in `dev/.env.local` must include the origins you use (shell and dashboard dev servers). Internal service calls use Docker network URLs and ignore that list ([dev stack](/dev-stack)).

For dashboard or test records, pick a **unique** project or company name (for example append a timestamp) so local retries do not hit duplicate-name rules.

## Human CLI login (identity OAuth, PKCE)

`shellui login` has **`--config`** and **`--provider`** only (`shellui login --help`). It resolves **`backend.url`**, **`backend.companyId`** from `shellui.config.json`, opens identity **`GET /api/v1/authorize`** with **PKCE** (`code_challenge`, `code_challenge_method=S256`), redeems at **`POST /api/v1/oauth/session`**. The verifier stays in the CLI process; tokens are **not** printed. Storage: OS keychain when available, else `~/.config/shellui/credentials.json` mode `0600`. Full flow: [CLI reference](/cli#shellui-login-root).

**SaaS URL for `projects` commands:** set **`saas.url`** in config or **`SHELLUI_SAAS_URL`**. If neither is set, the CLI defaults to **`http://localhost:8005`** for smoke only ([`resolveSaasBaseUrl`](https://github.com/shellui/shellui/blob/develop/packages/cli/src/commands/service-resolve.js)).

There is **no** `shellui auth login --saas-url` flag today; set env or config as above.

## Companies and projects (human Bearer)

| Command                       | HTTP                                           |
| ----------------------------- | ---------------------------------------------- |
| `shellui companies list`      | Identity `GET /api/v1/companies/`              |
| `shellui companies get 1`     | Identity `GET /api/v1/companies/1/`            |
| `shellui projects list`       | SaaS `GET /api/v1/companies/`                  |
| `shellui projects get {uuid}` | SaaS `GET /api/v1/companies/{uuid}/`           |
| `shellui projects regions`    | SaaS `GET /api/v1/regions/`                    |
| `shellui projects endpoints`  | SaaS `GET /api/v1/companies/{uuid}/endpoints/` |

**`shellui projects create` is not implemented.** Dashboard company creation for agents is **global MCP** (OAuth + approvals), not this CLI action ([`projects.js`](https://github.com/shellui/shellui/blob/develop/packages/cli/src/commands/projects.js)).

## Global SaaS MCP: consent and client registration

Generic HTTP clients that only support **GET** cannot complete Shellui’s **POST**-based global consent; use the dashboard or a client that follows [saas-service docs/mcp.md](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md). Fetch OAuth metadata from the SaaS host: `GET /.well-known/oauth-protected-resource`, `GET /.well-known/oauth-authorization-server`, **`GET /api/schema/`** for client routes.

Register a **public** MCP OAuth client in that environment, use **PKCE** (S256), send **`state`** on authorize, and store **`client_id`** (and **`client_secret`** only when the server issues a confidential client). Do not put tokens in shell history: prefer **`export AGENT_ACCESS_TOKEN`** in an interactive session loaded from your OS secret store or a short-lived env file excluded from git.

## Global MCP: `tools/list` then `tools/call`

Every tool name and argument schema comes from the **`tools/list`** response on **`POST {saas}/mcp`**, not from this page. Empty **`arguments`** is **`{}`**, not **`null`**, unless the schema says otherwise.

```bash
curl -sS -X POST "${SAAS_BASE}/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AGENT_ACCESS_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

```bash
BODY='{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{'
BODY="$BODY\"name\":\"REPLACE_WITH_TOOLS_LIST_NAME\",\"arguments\":{}}}"
curl -sS -X POST "${SAAS_BASE}/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AGENT_ACCESS_TOKEN" \
  -d "$BODY"
```

**First company create:** the operation id (often shaped like `api_v1_companies_create`), **`path_params`**, **`body`**, and **`services`** array are defined in **`GET {saas}/api/schema/`** and [saas-service docs/mcp.md](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md). Typical consent parameters include **`access_mode`**, **`read_level`**, **`allow_destructive`**, and a **`services`** list naming which regional APIs the agent may touch; copy exact strings from the schema. Pending creates return metadata with an **`approval_id`** for a human step.

## Human approval: approve, deny, session

After a pending write, a human with a **member** identity token **`POST`s** the decision to SaaS. Exact path and body field names (**`decision`**, **`session_allow`**, etc.) must match **`GET {saas}/api/schema/`** and the handbook on your revision—copy them from there, not from memory.

**Gateway (AI) in-chat flow** (per [ai-service MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)): a blocked write can return **`_meta.shellui_approval`**. The client retries **`tools/call`** with **`params._meta.shellui_approval.decision`** set to **`allow`**, **`deny`**, or **`session_allow`**. Identity records **`allow`**, **`deny`**, or **`allow_session`** via internal endpoints; **`session_allow`** applies only to **non-destructive** writes for about **60 seconds** on the same **`Mcp-Session-Id`**. Destructive writes cannot use session allow (**409** if attempted). Audit-style results include **`pending`**, **`denied`**, **`expired`**, **`client_denied`**, **`approved`**, etc.

**Denied:** do not retry the same write without a new approval path. **Revoked session:** obtain a new agent token and reconnect.

## Regional AI gateway: tool naming

**`tools/list`** on **`POST {PUBLIC_AI_URL}/c/{REGIONAL_COMPANY_ID}/mcp`** exports downstream tools as **`{service}_{tool}`** with a **single** underscore ([ai-service MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)), for example names resembling **`storage_list_buckets`** or **`saas_list_projects`**. Upstream OpenAPI **`operation_id`** values on each service are a separate naming scheme; **always copy the gateway’s exported name** from **`tools/list`**, not a guessed concatenation.

## Storage: MCP and REST

**Handbooks:** [storage MCP](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md), [buckets and objects](https://github.com/shellui/storage-service/blob/develop/docs/buckets-and-objects.md).

**REST (authoritative paths):** company bucket **`GET /storage/v1/bucket`**, **`GET /storage/v1/bucket/company`**, object upload **`POST` or `PUT /storage/v1/object/company/{path}`**, list **`POST /storage/v1/object/list/company`**, connectors **`POST /storage/v1/connector`**, and related routes in that doc.

**Human CLI (session JWT):** `shellui storage buckets list` → **`GET /storage/v1/bucket`**; `shellui storage buckets get` → **`GET /storage/v1/bucket/company`** ([CLI reference](/cli#shellui-storage-buckets-action-name-root)). No file upload subcommand; uploads go through the **SDK** in an iframe or **REST/MCP** with an agent token.

**iframe SDK:** after `shellui.init()`, `shellui.storage.from('company').upload(...)`, `list(...)` ([SDK](/sdk)).

## Hosting: deploy MCP sequence and CLI dist upload

**Handbook:** [hosting MCP](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md).

**Verified operation ids (from that handbook):**

1. **`hosting_v1_apps_create`** or **`hosting_v1_preview_create`** or **`hosting_v1_apps_list`** / **`hosting_v1_apps_retrieve`**
2. **`hosting_v1_apps_deployments_create`** — body includes **`app_version`**, **`shellui_version`**
3. **`hosting_v1_apps_deployments_artifact_upload_url_create`** — returns **`upload_url`**, **`method`** `PUT`, **`headers`**, **`requires_bearer`**
4. **HTTP PUT** of **`.tar.gz`** bytes to **`upload_url`** (not JSON-RPC). If **`requires_bearer`**, send the **same agent Bearer** on that PUT.
5. **`hosting_v1_apps_deployments_artifact_upload_complete_create`**
6. **`hosting_v1_apps_deployments_finalize_create`**

**Domains:** `GET/POST /hosting/v1/apps/{app_ref}/domains`, etc. **Env:** `…/environment` returns **`value_present`**, not plaintext. **Logs:** runtime may return **`source: none`** for static sites.

**Human preview from laptop:** `shellui build` then `shellui deploy` (7-day preview, deploy token or session per [CLI reference](/cli#shellui-deploy-root)); that path is **not** the MCP artifact sequence above.

## Email: render-preview and MCP

**Handbook:** [email MCP](https://github.com/shellui/email-service/blob/develop/docs/mcp.md). Agent JWT: **`aud`** = **`{EMAIL_PUBLIC_URL}/mcp`**, **`scope`** includes **`email`**.

Verified **`tools/call`** shape from that doc (replace **`template_id`** and tool **name** from your **`tools/list`**):

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

**`render-preview`** does not send mail. **`send-test`** sends one message to the owner. Treat rendered HTML as untrusted when displaying in a browser.

## OpenAPI entry points

| Service  | Schema URL (local dev)                  |
| -------- | --------------------------------------- |
| Identity | `GET http://localhost:8001/api/schema/` |
| Storage  | `GET http://localhost:8002/api/schema/` |
| Hosting  | `GET http://localhost:8003/api/schema/` |
| Email    | `GET http://localhost:8004/api/schema/` |
| SaaS     | `GET http://localhost:8005/api/schema/` |

Use **`jq`**, **`curl`**, and **stdlib Python** for scripts; avoid **GNU-only** `date -d` on macOS.

## Token lifetime

Read **`expires_in`** from the token response and the identity handbook. No fixed nominal TTL is documented here.

## Global versus regional tokens

Do **not** assume a **global** SaaS agent JWT can call **`POST /mcp`** on storage, hosting, or email **directly** without the **exchange** or **gateway** flow identity documents for your deployment. The **AI gateway** mints short-lived downstream tokens via **`POST /api/v1/mcp/internal/mcp-downstream-access-token`** ([ai-service MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)).

## One path to assemble an app (outline)

1. **`shellui login`** with valid **`shellui.config.json`** ([CLI reference](/cli)).
2. **`shellui companies list`** — note regional decimal id.
3. **`shellui projects list`** — note dashboard **UUID**; **`shellui projects use {uuid}`** if you prefer defaults.
4. **`shellui projects endpoints`** — copy **`mcp.identity`**, **`mcp.storage`**, **`mcp.hosting`**, **`mcp.email`**. Set AI work to **`PUBLIC_AI_URL`** / gateway URL with **`REGIONAL_COMPANY_ID`** from **`projects get`**.
5. **Agent path:** complete OAuth + consent for **global** MCP if you need dashboard-level tools; run **`tools/list`** on SaaS, then **`tools/call`** with schema-derived bodies; poll company and approval state per handbook.
6. **Regional agent path:** obtain agent JWT with correct **`aud`** for each service or use the **AI gateway** and names from its **`tools/list`**.
7. **Storage content:** SDK upload or REST/MCP write paths from [buckets and objects](https://github.com/shellui/storage-service/blob/develop/docs/buckets-and-objects.md).
8. **Hosting go-live:** MCP sequence above or **`shellui deploy`** for preview.
9. **Email:** **`render-preview`** then rules or sends as policy allows.

## Smoke commands (human CLI)

```bash
node packages/cli/bin/shellui.js login
node packages/cli/bin/shellui.js auth status
node packages/cli/bin/shellui.js companies list
node packages/cli/bin/shellui.js projects list
node packages/cli/bin/shellui.js projects regions
node packages/cli/bin/shellui.js projects endpoints
node packages/cli/bin/shellui.js storage buckets list
node packages/cli/bin/shellui.js hosting apps list
```

## Environment variables the CLI reads

| Variable           | Used for                                                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SHELLUI_SAAS_URL` | SaaS base when `saas.url` is absent ([service-resolve.js](https://github.com/shellui/shellui/blob/develop/packages/cli/src/commands/service-resolve.js)) |
| `SHELLUI_CONFIG`   | Config path override (see `shellui --help` per subcommand)                                                                                               |

Other URLs come from **`shellui.config.json`** (`backend.url`, `saas.url`, `storage.url`, `hosting.url`). The [CLI reference](/cli) documents each command.

## Negative and retry matrix (conceptual)

Use this with **`tools/list`** responses and HTTP status codes on your stack.

| Situation                                | What to do                                                                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`401` / invalid `aud`**                | Stop; mint or exchange a token whose **`aud`** matches the MCP resource URL for that host.                                                         |
| **Pending approval**                     | Human completes approval per SaaS handbook; agent retries the **same** `tools/call`.                                                               |
| **`_meta.shellui_approval` with `deny`** | Do not retry the same args; change the request or abandon.                                                                                         |
| **`session_allow` window ended**         | Expect a new prompt for the next non-destructive write ([ai-service MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)). |
| **Destructive write**                    | Session allow does **not** apply; **409** if you try ([ai-service MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)).   |
| **Revoked agent**                        | Obtain a new agent access token; old token fails revocation checks.                                                                                |

## `shellui deploy` (human, dist to preview)

From [CLI reference](/cli#shellui-deploy-root): builds **`dist/web/`**, uploads a **preview** (7-day TTL), stores **`hosting.slug`** after first deploy. Uses the **same** `shellui login` session as other CLI commands, not **`SHELLUI_DEPLOY_TOKEN`** (that env is a separate CI path when configured).

```bash
shellui build
shellui deploy
```

See **`shellui deploy --help`** for **`--build`**, **`--slug`**, **`--dry-run`**, **`history`**, **`rollback`**.

## Storage: list objects over REST (session token)

**Handbook path:** **`POST /storage/v1/object/list/company`** ([buckets and objects](https://github.com/shellui/storage-service/blob/develop/docs/buckets-and-objects.md)). Body fields come from **`GET http://localhost:8002/api/schema/`**. Example skeleton only—**fill keys from OpenAPI**:

```bash
export STORAGE_BASE="http://localhost:8002"
export IDENTITY_ACCESS_TOKEN="load from credential store without printing"
curl -sS -X POST "$STORAGE_BASE/storage/v1/object/list/company" \
  -H "Authorization: Bearer $IDENTITY_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

For MCP, call the tool name from **`tools/list`** on **`POST $STORAGE_BASE/mcp`** with **`arguments.path`**, **`method`**, **`body`** matching that operation.

## Python stdlib: MCP `tools/list` (global saas)

```python
import json, os, urllib.request

def post_json(url, token, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer %s" % token,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)

saas_mcp = os.environ["SAAS_BASE"].rstrip("/") + "/mcp"
agent = os.environ["AGENT_ACCESS_TOKEN"]
post_json(saas_mcp, agent, {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}})
```

## AI gateway: `tools/list` shape

Call **`POST {PUBLIC_AI_URL}/c/{REGIONAL_COMPANY_ID}/mcp`** with an agent JWT whose **`aud`** is that full URL (**[ai-service MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)**). Parsed tools include gateway-native entries plus downstream exports; **downstream** names follow **`{service}_{tool}`** (single underscore). **Do not** assume **`identity_api_v1_*`** unless that exact string appears in **`tools/list`**.

## First company and dashboard provisioning (high level)

Flows differ by operator configuration. In general: a **global human** completes identity and SaaS steps, then the dashboard company row moves from provisioning to active and gains **`regional_company_id`**. **Do not** assume a fixed numeric id (for example `1`) on shared hosts. Poll **`shellui projects get {uuid} --json`** and compare fields to **`GET {saas}/api/schema/`** for **`Company`** or the relevant serializer—**field names and status strings are defined there**.

## `session_allow` on the human SaaS approval endpoint

The SaaS HTTP API for posting a human decision after a pending global MCP approval uses body fields defined in **`GET {saas}/api/schema/`** (often including **`decision`** and **`session_allow`** as booleans). **Copy the serializer from your revision.** The AI gateway’s in-chat **`params._meta.shellui_approval.decision`** values **`allow`**, **`deny`**, **`session_allow`** are **JSON-RPC**-side names ([ai-service MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)); they are **not** guaranteed to match HTTP approval JSON one-for-one without checking the schema.

## Prereqs on developer laptops

- **OpenSSL** for local key experiments (macOS LibreSSL builds may differ from Linux; prefer the **stack generator** for JWKS).
- **curl**, **jq**, **Python 3** with **`urllib`** (stdlib) for scripts; add **`cryptography`** only if you extend **`generate_env.py`** locally.
- **Node** for **`node packages/cli/bin/shellui.js`** from the monorepo.

## Security habits

- Never **`echo`** access tokens into shared terminals or CI logs.
- Prefer **OS keychain** (see [CLI reference](/cli#shellui-login-root)); file fallback is user-private **`0600`** only.
- Keep **`.env.local`** out of git and out of screenshots.
- **Treat `render-preview` HTML as untrusted** if you render it in a browser ([email MCP](https://github.com/shellui/email-service/blob/develop/docs/mcp.md)).

## When something does not match

Handbooks track **`develop`**; your deployment might lag. **`GET /api/schema/`** and **`tools/list`** on **your** hosts override everything in this guide. If SaaS raw URLs 404 anonymously, open the file in the **org clone**.

## Service handbook index

- [Identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)
- [SaaS MCP](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md)
- [Storage MCP](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md) · [Buckets and objects](https://github.com/shellui/storage-service/blob/develop/docs/buckets-and-objects.md)
- [Hosting MCP](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md)
- [Email MCP](https://github.com/shellui/email-service/blob/develop/docs/mcp.md)
- [AI MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)

## Related in this repo

- [Authentication](/features/authentication)
- [CLI](/cli)
- [SDK](/sdk)
- [Local dev stack](/dev-stack)
