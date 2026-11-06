---
title: AI native platform (developer guide)
sidebar_label: AI native platform
description: Local stack, OAuth, SaaS MCP, token exchange, and regional MCP.
---

This guide lists **source-backed** commands from identity-service, ai-service,
storage-service, hosting-service, and email-service `develop` branches (as read
when this file was last revised).

It does **not** claim a full Docker MCP run was completed in CI here. For deeper
API coverage, read each service handbook (linked at the end).

## Table of contents

- [Verification status](#verification-status)
- [SaaS global MCP (readme in clone)](#saas-global-mcp-readme-in-clone)
- [Start stack and ports](#start-stack-and-ports)
- [Dev region and JWT audience](#dev-region-and-jwt-audience)
- [Human account and token roles](#human-account-and-token-roles)
- [OAuth registration](#dynamic-client-registration-and-oauth)
- [Global consent POST](#global-consent-post)
- [First company on global SaaS MCP](#first-company-on-global-saas-mcp)
- [Dashboard UUID and regional id](#dashboard-uuid-and-regional-id)
- [Regional agent exchange RFC 8693](#regional-agent-exchange-rfc-8693)
- [Human /oauth/token](#optional-human-session-exchange-at-oauthtoken)
- [Service MCP examples](#service-mcp-examples)
- [shellui.config.json](#shelluiconfigjson)
- [Approvals, session, revocation](#approvals-session-revocation)
- [CLI scope](#cli-scope)
- [Troubleshooting](#troubleshooting)

## SaaS global MCP (readme in clone)

SaaS global MCP tool names and response shapes live in **saas-service** (often
`docs/mcp.md`). This org repo is private, so open the file from your clone; do
not rely on anonymous raw GitHub URLs.

## Verification status

The curl and JSON-RPC blocks in this page match **current** identity and service
source for URL paths, grant names, and handler rules. A full end-to-end run
(local compose, browser consent, approvals, gateway, downstream services) is a
**manual** check on your machine. This repo does not assert that run here.

## Start stack and ports

From `shellui/dev`:

```bash
./generate-env.sh
./start.sh
```

`./start.sh` runs `./generate-env.sh`, then brings compose up with your
`dev/.env.local` ([start][start-sh]). `generate-env.sh` uses `uv run
--no-project --with cryptography` when `uv` is present so `cryptography`
imports succeed.

Host ports from [compose][compose-yml]:

| Service    | Publish | Notes                                       |
| ---------- | ------- | ------------------------------------------- |
| Shell      | 4000    | Vite shell                                  |
| Identity   | 8001    | Compose `- '8001:8000'`; OAuth at `/oauth/` |
| Storage    | 8002    | `/storage/v1/`                              |
| Hosting    | 8003    | `/hosting/v1/`                              |
| Email      | 8004    | `/api/v1/` under `/`                        |
| SaaS API   | 8005    | `/api/v1/` and `POST /mcp`                  |
| AI gateway | 8006    | `http://localhost:8006/c/your_id_here/mcp`  |
| Mailpit    | 8025    | Web UI                                      |
| Admin      | 5173    | Vite                                        |
| Dashboard  | 5174    | Vite                                        |
| Files      | 5175    | Vite                                        |
| Playground | 5176    | Vite                                        |
| Postgres   | 5432    | Debug                                       |
| Redis      | 6379    | Debug                                       |

Export bases once per shell:

```bash
export REGIONAL_IDENTITY_ORIGIN="http://127.0.0.1:8001"
export SAAS_ORIGIN="http://127.0.0.1:8005"
export STORAGE_ORIGIN="http://127.0.0.1:8002"
export HOSTING_ORIGIN="http://127.0.0.1:8003"
export EMAIL_ORIGIN="http://127.0.0.1:8004"
export PUBLIC_AI_URL="http://127.0.0.1:8006"
```

## Dev region and JWT audience

`dev/.env.local.example` sets `DEV_REGION_CODE=ch` and `REGION_CH_*_ORIGIN`
rows that point at local ports (identity **8001**, storage **8002**, hosting
**8003**, email **8004**, SaaS **8005**, AI **8006**). For example
`REGION_CH_IDENTITY_ORIGIN` expands to `PUBLIC_IDENTITY_URL` on port **8001**.
SaaS registers **ch** and **eu** in real installs; **`local` is not** a SaaS
region code, so first company creation uses **`"region":"ch"`** against your
local SaaS MCP.

`PUBLIC_SAAS_URL` is the SaaS API base (`POST /mcp` for global MCP). For **RFC
8693 global-agent exchange**, identity verifies the **subject** JWT against
`GLOBAL_ISSUER_URL` and `GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE` (`exchange.py`).
That **aud** string is **not** the same as the **issued** regional token `aud`.
The issued `aud` is the MCP `resource` URL from the exchange body
(`mcp_resources.py`).

**Global resource URL:** OAuth `resource` is a normal **http** or **https** URL.
The ai gateway form is `http://localhost:8006/c/<company_id>/mcp` and only works
on loopback hosts (`mcp_resources.py`). Do not invent `saas://` URIs.

This stack passes `GLOBAL_AGENT_PRIVATE_KEY` and `GLOBAL_AGENT_KEY_ID` into
**saas** and mirrors the same PEM and kid as `GLOBAL_AGENT_SIGNING_KEY` and
`GLOBAL_AGENT_SIGNING_KID` (`dev/docker-compose.yml`, `.env.local.example`).
`generate_env.py` fills the `__GLOBAL_AGENT_*__` placeholders and **appends**
missing keys without rotating existing values. Identity `GLOBAL_JWKS` must stay
the public half of that key; identity and saas kid strings must match.

## Human account and token roles

Before any agent work:

1. Create a **non-staff** member in the shell or dashboard dev app.
2. Accept **Terms of Service** in the product UI.

Order matters: **human Terms and dashboard session exist before** global agent
OAuth or MCP writes. `shellui login` stores a **regional** human JWT for CLI;
it never prints access tokens ([CLI login][cli-login]). That JWT is **not** the
global agent subject. For browser flows, the shell holds the human session
(see `/api/auth/session` in `@shellui/core`); do not paste human JWTs into
`.env` for agents.

**Human session** (Bearer from login or browser) is for approvals, dashboard,
and `shellui projects list`.

**Regional MCP agent JWT** (after browser consent and auth-code exchange at
`POST /oauth/mcp/token`) carries `aud` equal to the **resource** you sent
(usually the ai gateway URL). That token calls the gateway and SaaS tools.
**Global agent JWT** (minted by SaaS for `api_v1_companies_create`) uses
`aud` = `GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE` and is the **subject** for RFC 8693
at `POST /oauth/mcp/token` on the region (`exchange.py`).

## Dynamic client registration and OAuth

Identity serves MCP OAuth at the issuer root ([urls][id-urls]).

### Register a client

`POST /oauth/mcp/register` accepts JSON or form bodies ([parse][parse-body]).

```bash
curl -sS -X POST "$REGIONAL_IDENTITY_ORIGIN/oauth/mcp/register" \
  -H "Content-Type: application/json" \
  -d '{
  "client_name": "your_agent_client_name_here",
  "redirect_uris": ["http://127.0.0.1:8765/callback"]
}'
```

Record `your_client_id_here` from `client_id`.

### PKCE verifier and challenge (S256)

```bash
your_verifier_here="$(openssl rand -base64 48 | tr -d '\n')"
your_challenge_here="$(printf '%s' "$your_verifier_here" | \
  openssl dgst -binary -sha256 | openssl base64 | tr -d '\n' | \
  tr '+/' '-_' | tr -d '=')"
```

### Authorize URL (GET)

`parse_authorize_request` requires `code_challenge` and
`code_challenge_method` S256 ([parse-auth][parse-auth]).

Consent **checkboxes** list identity, storage, hosting, and email only
(`oauth_views.py` builds `services` without the **ai** id). The **ai** connector
is the OAuth **resource** (`http://localhost:8006/c/your_regional_id_here/mcp`).
SaaS is a separate **`include_saas`** checkbox when the server offers it
(`mcp_saas_consent`).

For `["saas","ai"]` intent: turn on **include_saas** and set **resource** to
the ai gateway URL below.

```bash
python3 - <<'PY'
import urllib.parse
q = {
  "response_type": "code",
  "client_id": "your_client_id_here",
  "redirect_uri": "http://127.0.0.1:8765/callback",
  "scope": "openid",
  "state": "your_state_here",
  "code_challenge": "your_challenge_here",
  "code_challenge_method": "S256",
  "resource": "http://127.0.0.1:8006/c/your_company_id_here/mcp",
}
print("http://127.0.0.1:8001/oauth/mcp/authorize?" + urllib.parse.urlencode(q))
PY
```

Open the printed URL while signed in, or follow
[Global consent POST](#global-consent-post).

### Token (authorization_code)

After the redirect carries `code`, prefer **form** bodies. `mcp_token` uses
`parse_oauth_post_body`:

```bash
curl -sS -X POST "$REGIONAL_IDENTITY_ORIGIN/oauth/mcp/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "client_id=your_client_id_here" \
  --data-urlencode "code=your_authorization_code_here" \
  --data-urlencode "redirect_uri=http://127.0.0.1:8765/callback" \
  --data-urlencode "code_verifier=$your_verifier_here" \
  --data-urlencode "resource=http://127.0.0.1:8006/c/your_company_id_here/mcp"
```

JSON bodies are also accepted. The JSON payload includes `access_token`,
`token_type`, `expires_in`, and `refresh_token` (`oauth_views.py`). Never log
tokens.

The access token **aud** matches **resource** from the authorization row
(`oauth_views.py` binds `encode_access_token` to that URL). Staff accounts get
**403** on token redemption (`is_mcp_oauth_refused_user`).

## Global consent POST

The consent form on `GET /oauth/mcp/authorize` submits to the same path with
Django `csrfmiddlewaretoken` ([consent-html][consent-html]). A machine client
must send a **human** browser session (Cookie) and the CSRF token from the
GET response. Standard MCP stacks without an embedded browser need their own
integration for this POST.

`your_mcp_authorize_post.sh` (run after you copy CSRF and session values):

```bash
curl -sS -X POST "$REGIONAL_IDENTITY_ORIGIN/oauth/mcp/authorize" \
  -H "Cookie: sessionid=your_session_id_here" \
  -H "X-CSRFToken: your_csrftoken_here" \
  -F "csrfmiddlewaretoken=your_csrftoken_here" \
  -F "response_type=code" \
  -F "client_id=your_client_id_here" \
  -F "redirect_uri=http://127.0.0.1:8765/callback" \
  -F "resource=http://127.0.0.1:8006/c/your_company_id_here/mcp" \
  -F "state=your_state_here" \
  -F "code_challenge=your_challenge_here" \
  -F "code_challenge_method=S256" \
  -F "services=identity" -F "services=storage" -F "services=hosting" \
  -F "services=email" \
  -F "include_saas=on" \
  -F "access_mode=ask" -F "read_level=safe" \
  -F "agent_name=your_agent_label_here" \
  -F "decision=approve"
```

## First company on global SaaS MCP

After Terms, a **human** creates the first company via global SaaS MCP.

Use `POST {PUBLIC_SAAS_URL}/mcp` with the **global agent** JWT from SaaS consent
(see saas `docs/mcp.md` in your clone).

`shellui projects create` has no handler.

After the row exists, use read-only SaaS CLI commands.

Examples:

- `shellui projects list`
- `shellui projects get`
- `shellui projects regions`
- `shellui projects endpoints`
- `shellui projects use`

Human identity cookies are not valid as `Bearer` on SaaS MCP.

`your_create_company_here.json`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "api_v1_companies_create",
    "arguments": {
      "path": "/api/v1/companies",
      "path_params": {},
      "query": {},
      "method": "POST",
      "body": { "name": "Acme", "region": "ch" }
    }
  }
}
```

```bash
read -r -s SAAS_AGENT_BEARER
export SAAS_AGENT_BEARER
curl -sS -X POST "$SAAS_ORIGIN/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SAAS_AGENT_BEARER" \
  -d @your_create_company_here.json
```

When `isError` is true, read approval metadata (approval id, tool name) from
the structured content your saas build returns.

Treat durations as **server authority** (**600** to **900** seconds may apply on
first non-destructive setup). That window must stay **within** token lifetime.
The gateway **session_allow** path is **60** seconds, **non-destructive**, **one
connection** [identity-mcp].

Destructive tools need a **fresh** human approval each time, including `full`
access, unless `allow_destructive_without_asking` is enabled in your identity
config [identity-mcp].

### Approve as human member

Human **Bearer** is the regional identity JWT from `shellui login`, **not** a
global agent or SaaS token. Approvals APIs **reject agent** Bearer
(`require_approval_actor`, `allow_agent_token=False`).

`GET /api/v1/mcp/approvals` has **no** `status` query in source; it already
returns **pending** rows only (`McpApprovalListView`).

```bash
curl -sS \
  "$REGIONAL_IDENTITY_ORIGIN/api/v1/mcp/approvals?company_id=your_id_here" \
  -H "Authorization: Bearer $HUMAN_IDENTITY_BEARER"
```

```bash
APPROVALS="$REGIONAL_IDENTITY_ORIGIN/api/v1/mcp/approvals"
APP_DEC="$APPROVALS/your_approval_uuid_here/decide"
curl -sS -X POST "${APP_DEC}?company_id=your_id_here" \
  -H "Authorization: Bearer $HUMAN_IDENTITY_BEARER" \
  -H "Content-Type: application/json" \
  -d '{"decision":"approve"}'
```

`decision` may be **approve**, **allow**, **deny**, or **reject**
(`McpApprovalDecideView`). Open the dashboard app at `PUBLIC_DASHBOARD_URL` for
the same queue in UI. Session allow for the gateway stays separate
(`session_allow`, `allow_session`) [identity-mcp]. Retry the same `tools/call`
after approval.

Authorization binds one **company** and one **agent** grant. A new company needs
a **new** browser consent and code exchange. You cannot reuse one global JWT as
a universal app-data token across companies.

## Dashboard UUID and regional id

`api_v1_companies_retrieve`:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "api_v1_companies_retrieve",
    "arguments": {
      "path": "/api/v1/companies/{id}",
      "path_params": { "id": "your_dashboard_uuid_here" },
      "query": {},
      "method": "GET",
      "body": {}
    }
  }
}
```

`regional_company_id` may be absent until provisioning finishes. Exchange must
use the real decimal once present. Global MCP lists regional service URLs but
does not carry regional application data in the global JWT.

## Regional agent exchange RFC 8693

Call `POST $REGIONAL_IDENTITY_ORIGIN/oauth/mcp/token` with the token-exchange
grant (`handle_agent_token_exchange`, `oauth_views.py`).

The subject is a SaaS **global agent** access JWT. Identity checks `aud` with
`GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE` and `iss` with `GLOBAL_ISSUER_URL`
(`PUBLIC_SAAS_URL`). That check is **not** the gateway URL. The minted token
uses `aud` equal to the `resource` URL you post (often the gateway URL).

Repeat service ids from the global `scope` claim; optional `services` may only
**narrow** that list. Include **ai** when `resource` is the gateway. On dev the
gateway URL is `http://127.0.0.1:8006/c/<company_id>/mcp` (`mcp_resources.py`).

```bash
read -r -s GLOBAL_AGENT_JWT
EX_RES="http://127.0.0.1:8006/c/your_regional_id_here/mcp"
GT="urn:ietf:params:oauth:grant-type:token-exchange"
AT="urn:ietf:params:oauth:token-type:access_token"
curl -sS -X POST "$REGIONAL_IDENTITY_ORIGIN/oauth/mcp/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=$GT" \
  --data-urlencode "subject_token=$GLOBAL_AGENT_JWT" \
  --data-urlencode "subject_token_type=$AT" \
  --data-urlencode "requested_token_type=$AT" \
  --data-urlencode "company_id=your_regional_id_here" \
  --data-urlencode "resource=$EX_RES" \
  --data-urlencode "access_mode=read_only" \
  --data-urlencode "read_level=safe" \
  --data-urlencode "allow_destructive=false" \
  --data-urlencode "services=identity" \
  --data-urlencode "services=storage" \
  --data-urlencode "services=hosting" \
  --data-urlencode "services=email" \
  --data-urlencode "services=saas" \
  --data-urlencode "services=ai"
```

JSON bodies work too. JSON responses include `access_token` and
`issued_token_type`, plus `token_type`, `expires_in`, and `refresh_token`
(`handle_agent_token_exchange`).
Each subject **jti** is one-time (`_consume_subject_jti`). Minted tokens are
**regional** with `aud` equal to `resource`. Staff global agents are refused
(`_staff_refused`).

## Optional human session exchange at `/oauth/token`

On the **regional** identity host, `POST /oauth/token` accepts the same
token-exchange grant when the deployment is a region (`handle_token_exchange`).
The subject is a **global human session** access token; its `aud` must match
`GLOBAL_ACCESS_TOKEN_AUDIENCE` in settings (not the MCP resource string). This
path differs from `/oauth/mcp/token` and from agent exchange above.

### Gateway tool names

On the ai gateway, downstream tools are usually named **`service_tool`**
(one underscore), for example `storage_list_buckets` [ai-mcp].

On a service host, OpenAPI tools keep names like `storage_v1_object_list_create`
[storage-test].

Gateway `tools/list`. Use a regional agent JWT from exchange or auth code:

```bash
read -r -s REGIONAL_AGENT_JWT
curl -sS -X POST \
  "$PUBLIC_AI_URL/c/your_regional_id_here/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $REGIONAL_AGENT_JWT" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/list","params":{}}'
```

Downstream token mint happens at
`POST /api/v1/mcp/internal/mcp-downstream-access-token` inside ai-service
[identity-mcp]. Identity `list_services` is a tool on `POST`
`$REGIONAL_IDENTITY_ORIGIN/mcp` [identity-mcp].

## Service MCP examples

Handbooks: [storage MCP][storage-handbook], [hosting MCP][hosting-handbook],
[email MCP][email-handbook]. `tools/call` shape matches storage tests
[storage-test].

### Storage list (direct service `/mcp`)

Use bucket id **`company`**, the fixed company bucket name in storage-service
(`COMPANY_BUCKET_NAME`). The CLI blocks custom bucket creation; do not invent
another id for the default stack.

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "storage_v1_object_list_create",
    "arguments": {
      "path": "/storage/v1/object/list/{bucket_id}",
      "path_params": { "bucket_id": "company" },
      "method": "POST",
      "query": {},
      "body": {
        "prefix": "your_prefix_here",
        "limit": 50,
        "offset": 0,
        "search": "",
        "sortBy": { "column": "name", "order": "asc" }
      }
    }
  }
}
```

```bash
read -r -s STORAGE_AGENT_JWT
curl -sS -X POST "$STORAGE_ORIGIN/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STORAGE_AGENT_JWT" \
  -d @your_storage_list_here.json
```

### Storage list via gateway (name pattern)

Call the same JSON-RPC against `{PUBLIC_AI_URL}/c/your_regional_id_here/mcp` but
set `"name"` to the gateway export, for example `storage_list_buckets`, from
your live `tools/list` [ai-mcp].

### Storage write and read bytes

MCP JSON cannot carry raw upload bytes. Use REST with the same agent bearer
([storage-urls][storage-urls]):

```bash
printf 'your_sample_bytes' > your_sample_here.bin
curl -sS -X POST \
  "$STORAGE_ORIGIN/storage/v1/object/company/your_path_here.bin" \
  -H "Authorization: Bearer $STORAGE_AGENT_JWT" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @your_sample_here.bin
curl -sS \
  "$STORAGE_ORIGIN/storage/v1/object/company/your_path_here.bin" \
  -H "Authorization: Bearer $STORAGE_AGENT_JWT" \
  -o your_download_here.bin
```

### Hosting lifecycle

Create site ([hosting][hosting-views]):

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "hosting_v1_apps_create",
    "arguments": {
      "path": "/hosting/v1/apps",
      "method": "POST",
      "query": {},
      "body": {
        "name": "your_slug_here",
        "display_name": "Your Title"
      }
    }
  }
}
```

Open deployment:

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "hosting_v1_apps_deployments_create",
    "arguments": {
      "path": "/hosting/v1/apps/{app_ref}/deployments",
      "path_params": { "app_ref": "your_slug_here" },
      "method": "POST",
      "query": {},
      "body": {
        "app_version": "0.1.0",
        "shellui_version": "0.7.0",
        "pinned": false
      }
    }
  }
}
```

Upload URL:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "hosting_v1_apps_deployments_artifact_upload_url_create",
    "arguments": {
      "path": "/hosting/v1/apps/{app_ref}/deployments/{deployment_id}/artifact_upload_url",
      "path_params": {
        "app_ref": "your_slug_here",
        "deployment_id": "your_uuid_here"
      },
      "method": "POST",
      "query": {},
      "body": {}
    }
  }
}
```

PUT bytes to `upload_url` from the JSON result. `requires_bearer` from the tool
result tells you whether to add `Authorization: Bearer` on the PUT
(`ArtifactUploadUrlResponseSerializer`). Send `Content-Type` from the `headers`
map.

```bash
curl -sS -X PUT "$your_upload_url_here" \
  -H "Content-Type: application/gzip" \
  --data-binary @your_archive_here.tar.gz
```

Complete:

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "tools/call",
  "params": {
    "name": "hosting_v1_apps_deployments_artifact_upload_complete_create",
    "arguments": {
      "path": "/hosting/v1/apps/{app_ref}/deployments/{deployment_id}/artifact_upload_complete",
      "path_params": {
        "app_ref": "your_slug_here",
        "deployment_id": "your_uuid_here"
      },
      "method": "POST",
      "query": {},
      "body": {}
    }
  }
}
```

Finalize:

```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "tools/call",
  "params": {
    "name": "hosting_v1_apps_deployments_finalize_create",
    "arguments": {
      "path": "/hosting/v1/apps/{app_ref}/deployments/{deployment_id}/finalize",
      "path_params": {
        "app_ref": "your_slug_here",
        "deployment_id": "your_uuid_here"
      },
      "method": "POST",
      "query": {},
      "body": {}
    }
  }
}
```

### Email template list and render-preview

List template copies first so you have a real `template_id` integer
(`api_v1_templates_list` in [email-openapi-registry]).

```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "tools/call",
  "params": {
    "name": "api_v1_templates_list",
    "arguments": {
      "path": "/api/v1/templates",
      "path_params": {},
      "method": "GET",
      "query": {},
      "body": {}
    }
  }
}
```

Preview request fields are `number`, `subject`, `preheader`, `document`,
`theme`, `variables` ([email-schema] `TemplateRenderPreviewRequestSerializer`).
Response includes `subject`, `html`, `text`, `missing_variables`.

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tools/call",
  "params": {
    "name": "api_v1_templates_render_preview",
    "arguments": {
      "path": "/api/v1/templates/{template_id}/render-preview",
      "path_params": { "template_id": "your_id_here" },
      "method": "POST",
      "query": {},
      "body": {
        "subject": "Hello",
        "variables": { "company_name": "Acme" }
      }
    }
  }
}
```

## shellui.config.json

CLI commands share the schema in the monorepo Shellui config schema on
GitHub. Minimal local keys:

```json
{
  "backend": {
    "type": "shellui",
    "url": "http://127.0.0.1:8001",
    "companyId": "your_regional_decimal_id_here"
  },
  "saas": { "url": "http://127.0.0.1:8005" },
  "storage": { "url": "http://127.0.0.1:8002" },
  "hosting": { "url": "http://127.0.0.1:8003" },
  "email": { "url": "http://127.0.0.1:8004" }
}
```

SaaS paths are `/api/v1/` routes under `saas.url` ([projects][projects-js]).

## Approvals, session, revocation

- **Identity (human):** `POST /api/v1/mcp/approvals/{approval_id}/decide`.
- **AI gateway chat:** `_meta.shellui_approval` with `session_allow` [ai-mcp].
- **Identity internal:** `allow_session` for automation [identity-mcp].

Destructive tools need a **new** human approval in **every** access mode unless
`allow_destructive_without_asking` is on [identity-mcp]. Deny and revocation
override session allow [identity-mcp].

**Narrowing:** the exchange body may only tighten `services`, `access_mode`,
`read_level`, and `allow_destructive` [identity-mcp].

Activity labels in Shellui Settings come from `McpAgentActivitySection.tsx`:
`pending_approval`, `allowed`, `denied`, `failed`, `session_used`, plus
`unknown` for legacy rows [activity-tsx].

Call logs store **redacted** args only. They never store raw tool arguments,
query strings, or provider message bodies [identity-mcp].

Deny supersedes an earlier session allowance. Revocation invalidates older
refresh chains.

A **new** global access token cannot reactivate a revoked binding.
See [identity-mcp][identity-mcp].

Each global-agent **jti** is **single-use** for RFC 8693 exchange. See
`exchange.py`.

## CLI scope

`shellui projects create` is **not** implemented ([projects][projects-js]).
`shellui deploy` uploads a preview tarball; hosting MCP uses presigned URLs for
bytes instead.

- **`shellui auth status`:** login and session summary (no tokens).
- **`shellui projects list`:** `GET /api/v1/companies/` on `saas.url`.
- **`shellui projects regions`:** `GET /api/v1/regions/`.
- **`shellui projects endpoints`:** `GET /api/v1/companies/{uuid}/endpoints/`.
- **`shellui storage buckets list`:** `GET /storage/v1/bucket`.
- **`shellui hosting apps list`:** `GET /hosting/v1/apps`.

## Troubleshooting

- HTTP **401** wrong `aud`: token minted for another issuer or audience string.
- HTTP **403** staff: staff accounts cannot finish MCP consent [identity-mcp].
- HTTP **403** Terms: human has not accepted Terms for that identity tenant.
- HTTP **404** on AI host `/mcp`: use `/c/your_regional_id_here/mcp` [ai-mcp].
- HTTP **404** on global MCP: POST JSON-RPC to `PUBLIC_SAAS_URL` + `/mcp`.
- HTTP **404** on `regions` or `endpoints`: fix `saas.url` or the UUID path.
- HTTP **503** polls: regional services fail closed without identity.
- **Company id:** must match `regional_company_id` in the RFC 8693 exchange.

[start-sh]: https://github.com/shellui/shellui/blob/develop/dev/start.sh
[compose-yml]: https://github.com/shellui/shellui/blob/develop/dev/docker-compose.yml
[cli-login]: /cli#shellui-login-root
[id-urls]: https://github.com/shellui/identity-service/blob/develop/config/urls.py
[parse-body]: https://github.com/shellui/identity-service/blob/develop/apps/agents/oauth_request_body.py
[parse-auth]: https://github.com/shellui/identity-service/blob/develop/apps/agents/mcp_signin.py
[consent-html]: https://github.com/shellui/identity-service/blob/develop/templates/agents/mcp_consent.html
[mcp-tok]: https://github.com/shellui/identity-service/blob/develop/apps/agents/oauth_views.py
[identity-mcp]: https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md
[ai-mcp]: https://github.com/shellui/ai-service/blob/develop/docs/mcp.md
[decide-src]: https://github.com/shellui/identity-service/blob/develop/apps/agents/admin_views.py
[storage-test]: https://github.com/shellui/storage-service/blob/develop/apps/storage/tests/test_mcp.py
[storage-handbook]: https://github.com/shellui/storage-service/blob/develop/docs/mcp.md
[storage-urls]: https://github.com/shellui/storage-service/blob/develop/apps/storage/urls.py
[hosting-views]: https://github.com/shellui/hosting-service/blob/develop/apps/hosting/views.py
[hosting-handbook]: https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md
[email-schema]: https://github.com/shellui/email-service/blob/develop/apps/email/schema.py
[email-openapi-registry]: https://github.com/shellui/email-service/blob/develop/apps/email/openapi_mcp_registry.py
[email-handbook]: https://github.com/shellui/email-service/blob/develop/docs/mcp.md
[activity-tsx]: https://github.com/shellui/shellui/blob/develop/packages/core/src/features/settings/components/McpAgentActivitySection.tsx
[projects-js]: https://github.com/shellui/shellui/blob/develop/packages/cli/src/commands/projects.js
