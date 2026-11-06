---
title: AI native platform (developer guide)
sidebar_label: AI native platform
description: Local stack, OAuth, SaaS MCP, token exchange, and regional MCP.
---

## Table of contents

- [Start stack and ports](#start-stack-and-ports)
- [Human account and token roles](#human-account-and-token-roles)
- [OAuth registration](#dynamic-client-registration-and-oauth)
- [First company on global SaaS MCP](#first-company-on-global-saas-mcp)
- [Dashboard UUID and regional id](#dashboard-uuid-and-regional-id)
- [Regional token exchange RFC 8693](#regional-token-exchange-rfc-8693)
- [Service MCP examples](#service-mcp-examples)
- [Approvals, session, revocation](#approvals-session-revocation)
- [CLI scope](#cli-scope)
- [Troubleshooting](#troubleshooting)

SaaS global MCP behavior is in **saas-service** `docs/mcp.md`. Clone the repo
and open that file locally when raw GitHub URLs return **404**.

## Start stack and ports

From `shellui/dev`:

```bash
./generate-env.sh
./start.sh
```

`./start.sh` runs `./generate-env.sh`, then brings compose up with your
`dev/.env.local` ([start][start-sh]).

Host ports from [compose][compose-yml]:

| Service    | Publish | Notes                                       |
| ---------- | ------- | ------------------------------------------- |
| Shell      | 4000    | Vite shell                                  |
| Identity   | 8001    | Compose `- '8001:8000'`; OAuth at `/oauth/` |
| Storage    | 8002    | `/storage/v1/`                              |
| Hosting    | 8003    | `/hosting/v1/`                              |
| Email      | 8004    | `/api/v1/` under `/`                        |
| SaaS API   | 8005    | `/api/v1/`                                  |
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

## Human account and token roles

Before any agent work:

1. Create a **non-staff** member in the shell or dashboard dev app.
2. Accept **Terms of Service** in the product UI.

**Human session** comes from the browser or `shellui login`. Use it for
`GET /api/v1/mcp/approvals` and dashboard flows.

**Agent JWT** comes from OAuth at identity (`POST /oauth/mcp/token`). Use it
for `POST /mcp` JSON-RPC on each regional service.

`shellui login` stores tokens in the OS keychain and does not print them
([CLI login][cli-login]).

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

`parse_authorize_request` requires `code_challenge` and `code_challenge_method`
S256 ([parse-auth][parse-auth]).

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

Open the printed URL in a browser while signed in. The consent **POST** fields
match [consent.html][consent-html] (`services`, `access_mode`, `read_level`,
`agent_name`, optional `include_saas`). Headless agents need a stored session
cookie from that login before they can replay a `POST` with the same fields.

### Token (authorization_code)

After the redirect carries `code`:

```bash
curl -sS -X POST "$REGIONAL_IDENTITY_ORIGIN/oauth/mcp/token" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg cid "your_client_id_here" \
    --arg code "your_authorization_code_here" \
    --arg uri "http://127.0.0.1:8765/callback" \
    --arg ver "$your_verifier_here" \
    --arg res "http://127.0.0.1:8006/c/your_company_id_here/mcp" \
    '{grant_type:"authorization_code",
      client_id:$cid,
      code:$code,
      redirect_uri:$uri,
      code_verifier:$ver,
      resource:$res}')"
```

Response fields are documented in [mcp_token][mcp-tok]. Never log tokens.

## First company on global SaaS MCP

Use the **global agent** JWT from SaaS consent (see saas `docs/mcp.md` in your
clone). Human identity cookies are not valid as `Bearer` on SaaS MCP.

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
      "body": { "name": "Acme", "region": "local" }
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

When `isError` is true, read approval metadata using the stable ids your
saas-service version returns. Destructive tools always need a fresh approval,
even in `full` mode, unless `allow_destructive_without_asking` is on
[identity-mcp].

SaaS may grant a longer **non-destructive** session on first setup (for
example **600** to **900** seconds) per saas-service policy. The AI gateway
session allow stays near **60** seconds [identity-mcp].

### Approve as human member

```bash
curl -sS \
  "$REGIONAL_IDENTITY_ORIGIN/api/v1/mcp/approvals?company_id=your_id_here" \
  -H "Authorization: Bearer $HUMAN_IDENTITY_BEARER"
```

```bash
APP="$REGIONAL_IDENTITY_ORIGIN/api/v1/mcp/approvals"
curl -sS -X POST "$APP/your_approval_uuid_here/decide" \
  -H "Authorization: Bearer $HUMAN_IDENTITY_BEARER" \
  -H "Content-Type: application/json" \
  -d '{"decision":"approve"}'
```

Identity **develop** accepts `decision` **approve** or **deny** only
([decide][decide-src]). Retry the same `tools/call` file after approval.

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
does not act as an application-data API for those services.

## Regional token exchange RFC 8693

```bash
read -r -s GLOBAL_AGENT_JWT
EX_RES="http://localhost:8006/c/your_regional_id_here/mcp"
curl -sS -X POST "$REGIONAL_IDENTITY_ORIGIN/oauth/mcp/token" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg st "$GLOBAL_AGENT_JWT" \
    --arg res "$EX_RES" \
    --argjson cid your_regional_id_here \
    '{grant_type:"urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token:$st,
      subject_token_type:"urn:ietf:params:oauth:token-type:access_token",
      company_id:$cid,
      resource:$res,
      access_mode:"read_only",
      read_level:"safe",
      allow_destructive:false,
      services:["identity","storage","hosting","email","saas"]}')"
```

Optional fields only **narrow** the global grant [identity-mcp].

Gateway `tools/list`:

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

`tools/call` shape matches storage tests [storage-test].

### Storage list

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
        "app_version": "1.0.0",
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
      "path": "/hosting/v1/apps/{app_ref}/deployments/{deployment_id}/artifact-upload-url",
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

PUT bytes to `upload_url` from the JSON result:

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
      "path": "/hosting/v1/apps/{app_ref}/deployments/{deployment_id}/artifact-upload-complete",
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

### Email render-preview

Fields are `number`, `subject`, `preheader`, `document`, `theme`, `variables`
[email-schema]. Response includes `subject`, `html`, `text`,
`missing_variables`.

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

## Approvals, session, revocation

- **Identity (human):** `POST /api/v1/mcp/approvals/{approval_id}/decide`.
- **AI gateway chat:** `_meta.shellui_approval` with `session_allow` [ai-mcp].
- **Identity internal:** `allow_session` for automation [identity-mcp].

Activity labels in Shellui Settings come from `McpAgentActivitySection.tsx`:
`pending_approval`, `allowed`, `denied`, `failed`, `session_used`, plus
`unknown` for legacy rows [activity-tsx].

Revocation blocks reuse of old refresh tokens. A new global JWT cannot revive a
revoked agent binding [identity-mcp].

## CLI scope

`shellui projects create` is **not** implemented ([projects][projects-js]).
`shellui deploy` uploads a preview bundle; hosting MCP uses artifact upload
URLs instead.

## Troubleshooting

- **`401` wrong `aud`:** token issuer or resource does not match the host.
- **`403` staff:** staff cannot authorize MCP [identity-mcp].
- **`404` on plain AI `/mcp`:** use `/c/{id}/mcp` [ai-mcp].
- **`404` token exchange:** region lacks `GLOBAL_*` trust [identity-mcp].
- **Revocation poll failure:** service denies MCP until identity is up.

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
[storage-urls]: https://github.com/shellui/storage-service/blob/develop/apps/storage/urls.py
[hosting-views]: https://github.com/shellui/hosting-service/blob/develop/apps/hosting/views.py
[email-schema]: https://github.com/shellui/email-service/blob/develop/apps/email/schema.py
[activity-tsx]: https://github.com/shellui/shellui/blob/develop/packages/core/src/features/settings/components/McpAgentActivitySection.tsx
[projects-js]: https://github.com/shellui/shellui/blob/develop/packages/cli/src/commands/projects.js
