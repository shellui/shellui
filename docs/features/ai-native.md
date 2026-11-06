---
title: AI native platform (developer guide)
sidebar_label: AI native platform
description: Local stack, OAuth, SaaS MCP, token exchange, regional MCP.
---

This guide lists **source-backed** commands from identity-service, ai-service,
storage-service, hosting-service, and email-service `develop` branches (as read
when this file was last revised).

It does **not** claim a full Docker MCP run was completed in CI here. For deeper
API coverage, read each service handbook (linked at the end).

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

`PUBLIC_SAAS_URL` is the SaaS host (`POST /mcp` is global MCP JSON-RPC).
`list_mcp_services` (`services.py`) lists plain `{origin}/mcp` URLs for SaaS,
identity, and others, plus AI on `{AI_URL}/mcp`.
`resolve_mcp_resource` in `mcp_resources.py` maps URLs to service ids.

**RFC 8693 global-agent exchange:** on the region, `handle_agent_token_exchange`
verifies the subject JWT with `GLOBAL_ISSUER_URL` and
`GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE` (`apps/agents/exchange.py`). Issued token
`aud` is the exchange `resource` URL, which is **not** the same string as the
global agent subject `aud`.

**Gateway resource:** `http://localhost:8006/c/<company_id>/mcp` only on loopback.
**Company id in the path must exist** (`parse_authorize_request` sets
`company_id` from `resource_company_id`; unknown companies fail after sign-in).
Use your real regional id (from SaaS retrieve or dev seed company **1**).

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

**Regional MCP agent JWT** (after consent and auth-code exchange at
`POST /oauth/mcp/token`) has `aud` equal to the **resource** URL you authorized
(`encode_access_token`). Authorize today needs a **gateway** `resource` with a
company id in the path, so `aud` matches that gateway URL.

**Global agent JWT** (SaaS mints for `api_v1_companies_create`) uses `aud` =
`GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`. It is the **subject** for RFC 8693 agent
exchange on the region (`handle_agent_token_exchange`).

**Human session exchange** uses **`POST /oauth/token`** on the region
(`TokenView`, `federation/provider.py`).
It calls `handle_token_exchange`. That is **not** the MCP token endpoint.

`shellui login` never prints tokens. Prefer **Settings** in the dashboard for
approvals; only use curl when you already have a human Bearer by a path you
trust.

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

### Authorize URL (GET) when a regional company already exists

`parse_authorize_request` requires PKCE **S256** ([parse-auth][parse-auth]). It
parses `resource` with `resolve_mcp_resource` and **requires** a company id from
**gateway** URLs (`resource_company_id` in `mcp_signin.py`). Plain `{SAAS}/mcp`
does **not** yield a company id in Identity **develop**. That yields
**`company_required`** at authorize time.

**Runnable path:** use the seeded company (**1** in `dev/.env.local.example`) or
any real regional id, then set `resource` to the **gateway**:

```text
http://localhost:8006/c/1/mcp
```

The **ai** service id comes from that URL; checkboxes still list storage,
hosting, email (`oauth_views` drops **ai** from the POST list). Turn on
**include_saas** for SaaS in `services_allowed` (`mcp_saas_consent`).

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
  "resource": "http://127.0.0.1:8006/c/1/mcp",
}
print("http://127.0.0.1:8001/oauth/mcp/authorize?" + urllib.parse.urlencode(q))
PY
```

Open the printed URL while signed in. See **Global consent POST** below
(`## Global consent POST`).

### Token (authorization_code)

Only **`POST /oauth/mcp/token`** handles MCP authorization codes (`mcp_token`).
Use **form** bodies (`parse_oauth_post_body`). `resource` must match the
authorization row.

```bash
curl -sS -X POST "$REGIONAL_IDENTITY_ORIGIN/oauth/mcp/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "client_id=your_client_id_here" \
  --data-urlencode "code=your_authorization_code_here" \
  --data-urlencode "redirect_uri=http://127.0.0.1:8765/callback" \
  --data-urlencode "code_verifier=$your_verifier_here" \
  --data-urlencode "resource=http://127.0.0.1:8006/c/1/mcp"
```

JSON bodies are also accepted. Response JSON includes `access_token`,
`token_type`, `expires_in`, and `refresh_token` (`oauth_views.py`). Never log
tokens.

The access token **aud** matches **resource** (`encode_access_token`). Staff
accounts get **403** (`is_mcp_oauth_refused_user`).

## Global consent POST

The consent form on `GET /oauth/mcp/authorize` submits to the same path with
Django `csrfmiddlewaretoken` ([consent-html][consent-html]). Prefer **Settings**
in the dashboard in a normal browser; curl is only for people who already hold
Cookie plus CSRF material.

`your_mcp_authorize_post.sh` (only when you have session plus CSRF):

```bash
curl -sS -X POST "$REGIONAL_IDENTITY_ORIGIN/oauth/mcp/authorize" \
  -H "Cookie: sessionid=your_session_id_here" \
  -H "X-CSRFToken: your_csrftoken_here" \
  -F "csrfmiddlewaretoken=your_csrftoken_here" \
  -F "response_type=code" \
  -F "client_id=your_client_id_here" \
  -F "redirect_uri=http://127.0.0.1:8765/callback" \
  -F "resource=http://127.0.0.1:8006/c/1/mcp" \
  -F "state=your_state_here" \
  -F "code_challenge=your_challenge_here" \
  -F "code_challenge_method=S256" \
  -F "services=storage" -F "services=hosting" \
  -F "services=email" \
  -F "include_saas=on" \
  -F "access_mode=ask" -F "read_level=safe" \
  -F "agent_name=your_agent_label_here" \
  -F "decision=approve"
```

SaaS opt-in can redirect through global identity sign-in
(`start_global_identity_signin` in `mcp_saas_consent.py`) before
`complete_pending_mcp_consent` finishes the row.

## First company on global SaaS MCP

**Order in Identity `develop`:** `parse_authorize_request` needs a **numeric
company id** in **gateway** `resource` URLs (`resource_company_id` in
`mcp_signin.py`). Plain `{PUBLIC_SAAS_URL}/mcp` has **no** company id there, so
you get **`company_required`**. Keep `SHELL_IDENTITY_COMPANY_ID=1` from
`./generate-env.sh` until you have a real row, or create a company first, then
use `http://127.0.0.1:8006/c/<id>/mcp` in authorize.

Minting the **global agent** JWT for SaaS `POST /mcp` is in **saas-service**
([requires SaaS source access](#saas-global-mcp-readme-in-clone)):

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
curl -sS -X POST "${SAAS_ORIGIN}/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SAAS_AGENT_BEARER" \
  -d @your_create_company_here.json
```

`shellui projects create` has no handler. After the row exists, read-only CLI:

- `shellui projects list`
- `shellui projects get`
- `shellui projects regions`
- `shellui projects endpoints`
- `shellui projects use`

When `isError` is true, read **approval** metadata from the tool result in your
SaaS build (clone). Treat **600** to **900** second windows as **server
authority** when your SaaS docs say so. Stay inside token **exp** on the agent
JWT.

**Session allow** on the gateway is **60** seconds, **non-destructive**, **one
connection** [identity-mcp]. **Destructive** tools need a **fresh** human
approval **every** time, in **every** access mode, **full** included, even after
**session_allow**. **Deny** and **revocation** override session allow
[identity-mcp].

### Approve as a signed-in human (Settings first)

`shellui login` does not print tokens. Prefer **Settings** plus **pending
approvals** in the dashboard UI at `PUBLIC_DASHBOARD_URL`.

Server route: **`POST /api/v1/mcp/approvals/{approval_id}/decide`** with JSON
`{"decision":"approve"}` (`McpApprovalDecideView`). **`decision`** may be
**approve**, **allow**, **deny**, or **reject** [decide-src].

Approvals need a **human** regional JWT. They **reject agent** Bearer
(`require_approval_actor`, `allow_agent_token=False` [permissions-src]).
`GET /api/v1/mcp/approvals` lists **pending** rows only [decide-src].
There is **no** `status` query.

Authorization ties one **company** and one **agent** row; a **new** company in
SaaS needs a **new** global agent subject and a **new** regional exchange. There
is no stable dashboard UUID that replaces regional numeric ids in exchanges.

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

In Identity **develop**, **`POST /oauth/mcp/token`** calls
`handle_agent_token_exchange` when `grant_type` is RFC 8693 (`mcp_token`).
**`POST /oauth/token`** routes **human** `handle_token_exchange` (`TokenView`).
Agent exchange is **not** on `/oauth/token` in this tree.

The subject is a SaaS **global agent** access JWT. Identity checks `aud` with
`GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE` and `iss` with `GLOBAL_ISSUER_URL`. The
issued token `aud` is the `resource` URL you post.

Global agent `scope` is **space-separated** service ids (`parse_services` in
`apps/agents/scope.py`). Optional `services` in the exchange body may only
**narrow** that list. Include **ai** when `resource` is the gateway URL. Repeat
`services` keys for each id. `parse_oauth_post_body` accepts repeated fields.

Example after first company exists (here **1** matches the dev seed):

```bash
read -r -s GLOBAL_AGENT_JWT
EX_RES="http://127.0.0.1:8006/c/1/mcp"
GT="urn:ietf:params:oauth:grant-type:token-exchange"
AT="urn:ietf:params:oauth:token-type:access_token"
curl -sS -X POST "$REGIONAL_IDENTITY_ORIGIN/oauth/mcp/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=$GT" \
  --data-urlencode "subject_token=$GLOBAL_AGENT_JWT" \
  --data-urlencode "subject_token_type=$AT" \
  --data-urlencode "requested_token_type=$AT" \
  --data-urlencode "company_id=1" \
  --data-urlencode "resource=$EX_RES" \
  --data-urlencode "access_mode=read_only" \
  --data-urlencode "read_level=safe" \
  --data-urlencode "allow_destructive=false" \
  --data-urlencode "services=storage" \
  --data-urlencode "services=hosting" \
  --data-urlencode "services=email" \
  --data-urlencode "services=saas" \
  --data-urlencode "services=ai"
```

JSON bodies work too. Response JSON includes `access_token` and
`issued_token_type`, plus `token_type`, `expires_in`, and `refresh_token`
(`handle_agent_token_exchange`).
Each subject **jti** is one-time (`_consume_subject_jti`).
Staff global agents fail (`_staff_refused`).

## Human session exchange at `/oauth/token`

On the **regional** host, `POST /oauth/token` with the same `grant_type`
delegates to **`handle_token_exchange`** for a **global human session** access
token (`TokenView`). Subject `aud` follows `GLOBAL_ACCESS_TOKEN_AUDIENCE` in
settings (`federation/exchange.py`). This path is **not** MCP agent exchange.

### Gateway tools

Use **`POST {PUBLIC_AI_URL}/c/<company_id>/mcp`** with a token whose `aud` is
that same URL (auth code or agent exchange). Call **`tools/list`**, then call
`tools/call` with the **name** and **arguments** shape from that list [ai-mcp].
Downstream token mint uses
`POST /api/v1/mcp/internal/mcp-downstream-access-token` on ai-service
[identity-mcp]. Identity answers `list_services` on regional `POST /mcp`
JSON-RPC [identity-mcp].

Gateway exports often use a `storage_` prefix.
Example: **`storage_list_buckets`**.
Service OpenAPI names look like `storage_v1_object_list_create` [storage-test].

```bash
read -r -s REGIONAL_AGENT_JWT
curl -sS -X POST \
  "$PUBLIC_AI_URL/c/1/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $REGIONAL_AGENT_JWT" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/list","params":{}}'
```

## Service MCP examples

Handbooks: [storage MCP][storage-handbook], [hosting MCP][hosting-handbook],
[email MCP][email-handbook]. Use **gateway** `tools/list` output to fill `name`
and `arguments`; static JSON here is **illustrative** only.

### Storage list

Use bucket id **`company`** (`COMPANY_BUCKET_NAME` in storage-service
`access.py`). Sort uses **`sortBy`** with `column` and `order` as in
`ObjectListRequestSerializer` ([storage-serializer]).

### Hosting lifecycle

Create site ([hosting][hosting-views] `AppCreateSerializer` uses **`name`**
only):

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
        "name": "my-app"
      }
    }
  }
}
```

Open deployment (`DeploymentCreateSerializer`: **`app_version`**,
**`shellui_version`**):

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "hosting_v1_apps_deployments_create",
    "arguments": {
      "path": "/hosting/v1/apps/{app_ref}/deployments",
      "path_params": { "app_ref": "my-app" },
      "method": "POST",
      "query": {},
      "body": {
        "app_version": "0.1.0",
        "shellui_version": "0.7.0"
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
        "app_ref": "my-app",
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

Build a small bundle with a top-level **`index.html`**:

```bash
tar -czf your_archive_here.tar.gz -C your_site_dir_here index.html
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
        "app_ref": "my-app",
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
        "app_ref": "my-app",
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

List template copies first so you have a real `template_id` integer from your
company rows (`api_v1_templates_list` in [email-openapi-registry]).

```json
{
  "jsonrpc": "2.0",
  "id": 10,
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
  "id": 11,
  "method": "tools/call",
  "params": {
    "name": "api_v1_templates_render_preview",
    "arguments": {
      "path": "/api/v1/templates/{template_id}/render-preview",
      "path_params": { "template_id": "your_company_template_id_here" },
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

Minimal keys for **`shellui projects`** and **`shellui auth status`**
([projects][projects-js]):

```json
{
  "backend": {
    "type": "shellui",
    "url": "http://127.0.0.1:8001",
    "companyId": "1"
  },
  "saas": { "url": "http://127.0.0.1:8005" }
}
```

Add `storage`, `hosting`, `email` only when your app reads them from config.

## Approvals, session, revocation

- **Identity (human):** `POST /api/v1/mcp/approvals/{approval_id}/decide`.
- **AI gateway chat:** `_meta.shellui_approval` with `session_allow` [ai-mcp].
- **Identity internal:** `allow_session` for automation [identity-mcp].

Destructive tools need a **fresh** human approval **every** time, in **every**
access mode, including `full` and after **session_allow** [identity-mcp]. Deny
and revocation override session allow [identity-mcp].

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
[permissions-src]: https://github.com/shellui/identity-service/blob/develop/apps/agents/permissions.py
[storage-serializer]: https://github.com/shellui/storage-service/blob/develop/apps/storage/serializers.py
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
