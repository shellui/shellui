---
title: AI native platform (global SaaS MCP, regional gateway, human CLI)
sidebar_label: AI native platform
description: Runnable-oriented map for MCP, OAuth, CLI, and dev stack.
---

## Table of contents

1. [Product story](#1-product-story-numbered)
2. [Implementation constraints](#2-implementation-constraints)
3. [Install and URLs](#3-install-and-urls)
4. [Human account](#4-human-account-tos-non-staff)
5. [SaaS endpoints](#5-saas-endpoints-payload)
6. [Token exchange](#6-global-agent-token-exchange-rfc-8693)
7. [AI gateway](#7-ai-gateway-url-and-tool-names)
8. [OAuth metadata](#8-oauth-authorize-and-optional-saas-flag)
9. [First company](#9-first-company-and-approvals)
10. [Approvals](#10-approval-semantics)
11. [MCP examples](#11-regional-service-mcp-examples)
12. [Human CLI](#12-human-cli)
13. [Secrets](#13-secrets-and-shell-history)
14. [Settings activity](#14-settings-ui-activity-labels)
15. [Handbooks](#15-openapi-and-handbooks)
16. [Troubleshooting](#16-troubleshooting)

## 1. Product story (numbered)

1. **Install and start:** from `shellui/dev`, run `./start.sh`
   ([dev stack][dev]).
   The table below lists literal localhost origins for compose.

2. **Human registration:** use a **normal member** account. Staff cannot finish
   MCP email link flows ([Identity MCP][identity-mcp]).
   Accept **Terms of Service** before agent consent is saved. No shared staff
   shell for MCP email authorize.

3. **Global SaaS OAuth:** the MCP client completes OAuth on identity with RFC
   8707 `resource` set to the **per-company AI URL**
   ([OAuth metadata](#8-oauth-authorize-and-optional-saas-flag)).
   SaaS control-plane rules live in your **saas-service** clone (`docs/mcp.md`
   when present). Copy SaaS tool **`name`** values from **`tools/list`** and
   **`GET ${SAAS_ORIGIN}/api/schema/`** instead of guessing.

4. **First dashboard company:** create it in the SaaS UI when provisioning is
   enabled, or call the create operation via **`POST ${SAAS_ORIGIN}/mcp`** with
   the exact tool from **`tools/list`**
   ([First company](#9-first-company-and-approvals)).
   Resolve **pending** metadata. Poll until **`regional_company_id`** is set.

5. **Resolve AI URL and regional id:** read
   `GET ${SAAS_ORIGIN}/api/v1/companies/DASHBOARD_UUID/endpoints/` or
   `shellui projects endpoints DASHBOARD_UUID`. Use **`PUBLIC_AI_URL`** from
   `dev/.env.local.example`. Gateway URL shape:
   **`POST ${PUBLIC_AI_URL}/c/REGIONAL_COMPANY_ID/mcp`**
   (example **`POST http://localhost:8006/c/42/mcp`**).

6. **Short-lived per-service access:** call
   **`POST ${REGIONAL_IDENTITY_ORIGIN}/oauth/mcp/token`** with RFC 8693 token
   exchange ([Token exchange](#6-global-agent-token-exchange-rfc-8693)). The
   regional JWT **`aud`** must match one **`ORIGIN/mcp`**. Do **not** POST an
   unexchanged global JWT to a regional **`/mcp`** [ai-mcp].

7. **Preview hosting:** follow hosting operation ids
   ([MCP examples](#113-hosting-deploy-operation-ids-from-handbook)).
   Writes that need a human use [Approvals](#10-approval-semantics). Email and
   storage follow those handbooks plus **`GET ${ORIGIN}/api/schema/`**.

8. **CLI:** after `shellui login`, set **`backend.url`**,
   **`backend.companyId`**, **`saas.url`**, **`storage.url`**,
   **`hosting.url`** ([Human CLI](#12-human-cli)).
   Use **`read -r -s`** then **`export`**
   ([Secrets](#13-secrets-and-shell-history)).

9. **Revoke:** pause, revoke, or grant edits can block exchange and refresh.
   **Reconnect** in the chat app does not restore a revoked persisted grant.
   Re-authorize ([Troubleshooting](#16-troubleshooting)).

## 2. Implementation constraints

- **Session allow (gateway):** Identity clamps
  **`MCP_APPROVAL_SESSION_TTL_SECONDS`** to **30 to 60** seconds [identity-mcp].
- **Session allow (wording):** Gateway JSON-RPC uses **`session_allow`** on
  retry; identity internal API uses **`allow_session`** [ai-mcp].
- **SaaS global session:** If your saas handbook documents **600 to 900** second
  non-destructive session behavior, treat that file as authoritative. Do not mix
  it up with the gateway **60** second window [identity-mcp].
- **Destructive tools:** Approval still applies when **`mcp_access`** is
  **`full`** unless **`allow_destructive_without_asking`** is on [identity-mcp].
- **Logs:** Call logs store **redacted** arguments only [identity-mcp].
- **Control plane:** SaaS **`/api/v1/companies/`** routes are dashboard and
  provisioning. They do not proxy regional application data.
- **`mcp.identity`:** The SaaS endpoints payload lists identity **`/mcp`** as a
  resource for tools such as **`list_services`**. It is not a personal REST JWT
  path.
- **PR 135 / 134:** Identity **develop** must land grant-field changes before
  this guide can assert new JWT claims [ai-mcp].

## 3. Install and URLs

| Purpose            | Dev default (compose)   |
| ------------------ | ----------------------- |
| Shell              | `http://localhost:4000` |
| Regional identity  | `http://localhost:8001` |
| Storage            | `http://localhost:8002` |
| Hosting            | `http://localhost:8003` |
| Email              | `http://localhost:8004` |
| SaaS dashboard API | `http://localhost:8005` |
| AI gateway         | `http://localhost:8006` |

Export once per shell session (no secrets in this block):

```bash
export REGIONAL_IDENTITY_ORIGIN="http://localhost:8001"
export SAAS_ORIGIN="http://localhost:8005"
export PUBLIC_AI_URL="http://localhost:8006"
export STORAGE_ORIGIN="http://localhost:8002"
export HOSTING_ORIGIN="http://localhost:8003"
export EMAIL_ORIGIN="http://localhost:8004"
```

**Global agent trust:** `dev/.env.local.example` sets
**`GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`**, **`GLOBAL_JWKS`**,
**`GLOBAL_AGENT_PRIVATE_KEY`**, **`GLOBAL_AGENT_KEY_ID`**. Run
`./generate-env.sh` in `shellui/dev` ([dev stack][dev]). Identity gets
**`GLOBAL_ISSUER_URL`** (`PUBLIC_SAAS_URL`), **`GLOBAL_JWKS`**,
**`GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`**.
**`dev/generate_env.py`** builds JWKS with OpenSSL and **cryptography**
([generate_env.py][gen-env]).

**AI signing:** in ai-service run **`python manage.py generate_signing_key`**
[ai-mcp].

## 4. Human account, ToS, non-staff

Use `shellui login` with `shellui.config.json` that sets **`backend.type`**,
**`backend.url`**, **`backend.companyId`** ([CLI login][cli-login]). The CLI
opens **`GET ${backend.url}/api/v1/authorize`** with PKCE.

**`user_metadata.is_staff` must be false** for global agent exchange
[identity-mcp].

Use **`shellui auth status`** to verify login without printing tokens.

## 5. SaaS endpoints payload

**Path:** `GET ${SAAS_ORIGIN}/api/v1/companies/DASHBOARD_UUID/endpoints/`

**CLI:** `shellui projects endpoints DASHBOARD_UUID` (same Bearer as login,
[CLI projects][cli-projects]).

**`project_mcp_endpoints.mcp` keys:** `identity`, `storage`, `hosting`, `email`
MCP resource URLs. **No** `ai` key. Use **`PUBLIC_AI_URL`** for the AI gateway
base.

Each **`mcp.*`** value ends with **`/mcp`**. Authorization server metadata flows
follow [identity-mcp].

## 6. Global agent token exchange (RFC 8693)

Source: [identity-mcp].

**Endpoint:** `POST ${REGIONAL_IDENTITY_ORIGIN}/oauth/mcp/token`

**Response:** `404` unless the server is **region** with
**`GLOBAL_ISSUER_URL`**, **`GLOBAL_JWKS`**, and
**`GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`**.

**Request body (replace string values with your tokens):**

```json
{
  "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
  "subject_token": "GLOBAL_AGENT_JWT_STRING",
  "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "company_id": "REGIONAL_COMPANY_ID_NUMERIC_STRING",
  "resource": "REGIONAL_SERVICE_MCP_RESOURCE_URL",
  "access_mode": "read_only",
  "read_level": "safe",
  "allow_destructive": false,
  "services": ["identity", "storage"]
}
```

Optional **`access_mode`**, **`read_level`**, **`allow_destructive`**, and
**`services`** only **narrow** the global grant. **`resource`** must match one
allowed **`ORIGIN/mcp`**. Paused or revoked regional agents block exchange
[identity-mcp].

**Example curl (after `read` for the subject token):**

```bash
read -r -s GLOBAL_AGENT_JWT_STRING
export GLOBAL_AGENT_JWT_STRING
curl -sS -X POST "$REGIONAL_IDENTITY_ORIGIN/oauth/mcp/token" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg st "$GLOBAL_AGENT_JWT_STRING" \
    --arg cid "1" \
    --arg res "$PUBLIC_AI_URL/c/1/mcp" \
    '{grant_type:"urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token:$st,
      subject_token_type:"urn:ietf:params:oauth:token-type:access_token",
      company_id:$cid,resource:$res,
      access_mode:"read_only",read_level:"safe",
      allow_destructive:false,services:["identity","storage"]}')"
```

Replace **`cid`**, **`res`**, and **`services`** using your grant and
**`tools/list`**.

## 7. AI gateway URL and tool names

**Gateway:** `POST ${PUBLIC_AI_URL}/c/REGIONAL_COMPANY_ID/mcp`
[ai-mcp].

**Plain** `POST ${PUBLIC_AI_URL}/mcp` returns **`404`** with
**`company_required`** [ai-mcp].

**Token `aud`** must equal the full per-company URL. A token for another company
is refused [ai-mcp].

**`tools/list`** exports downstream tools as **`<service>_<tool>`** (single
underscore), for example **`storage_list_buckets`** or **`saas_list_projects`**
[ai-mcp]. Copy names from **your** response.

**Downstream mint:** identity
**`POST /api/v1/mcp/internal/mcp-downstream-access-token`** signs RS256 from
ai-service, not the end-user JWT [identity-mcp].

## 8. OAuth authorize and optional SaaS flag

Protected resource metadata (RFC 9728):

```bash
# Join into one URL for curl or browser GET:
echo "${PUBLIC_AI_URL}/.well-known/oauth-protected-resource/c/${COMPANY_ID}/mcp"
```

When `SAAS_SERVICE_URL` is set, metadata may add
**`shellui_mcp_authorize_query`** so clients append **`saas_offered=1`** on
identity **`GET /oauth/mcp/authorize`** [ai-mcp].
Copy exact keys from **your** metadata JSON.

## 9. First company and approvals

**Human dashboard:** create the first dashboard company when provisioning is on.

**Agent global MCP:** call **`tools/list`** on **`POST ${SAAS_ORIGIN}/mcp`**.
Pick the create-company tool **`name`** from that JSON. Build **`tools/call`**
from **`GET ${SAAS_ORIGIN}/api/schema/`**.

**Pending:** read approval fields from **`tools/call`** results for your saas
revision.

**Poll** until **`regional_company_id`** is set:

```bash
shellui projects get DASHBOARD_UUID --json
```

Validate:

```bash
shellui projects get DASHBOARD_UUID --json | jq -e \
  '(.regional_company_id | type) as $t |
   ($t == "string" or $t == "number") and
   ((.regional_company_id | tostring | length) > 0)'
```

**`shellui projects create` is not implemented** [projects-js].

## 10. Approval semantics

**Identity owner HTTP (human Bearer, not agent):**

- **`GET /api/v1/mcp/approvals`**
- **`POST /api/v1/mcp/approvals/APPROVAL_UUID/decide`**
- Body **`{"decision": "approve"}`** or **`{"decision": "deny"}`**
  [identity-mcp]

**Gateway in-chat:** retry **`tools/call`** with
**`params._meta.shellui_approval.decision`** set to **`allow`**, **`deny`**, or
**`session_allow`**. The gateway calls identity
**`POST /api/v1/mcp/internal/mcp-approval-decide`** with **`allow`**,
**`deny`**, or **`allow_session`** [ai-mcp].

**Session allow (gateway):** **`MCP_APPROVAL_SESSION_TTL_SECONDS`**, clamp **30
to 60** seconds [identity-mcp].

**Destructive tools:** still need approval in **`full`** unless
**`allow_destructive_without_asking`** is on [identity-mcp].

**Denied:** do not replay the same **`tools/call`** without a new approval path.

## 11. Regional service MCP examples

### 11.1 Global SaaS `tools/list`

```bash
read -r -s AGENT_ACCESS_TOKEN
export AGENT_ACCESS_TOKEN
curl -sS -X POST "$SAAS_ORIGIN/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AGENT_ACCESS_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### 11.2 Email `api_v1_templates_render_preview`

From [email-mcp]:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "api_v1_templates_render_preview",
    "arguments": {
      "path": "/api/v1/templates/{template_id}/render-preview",
      "path_params": { "template_id": "12" },
      "method": "POST",
      "body": { "variables": { "company_name": "Acme" } }
    }
  }
}
```

Send with **`Authorization: Bearer`** to **`POST ${EMAIL_ORIGIN}/mcp`**. Confirm
**`name`** in **`tools/list`**.

### 11.3 Hosting deploy (operation ids from handbook)

From [hosting-mcp]:

1. **`hosting_v1_apps_create`**
2. **`hosting_v1_apps_deployments_create`**
3. **`hosting_v1_apps_deployments_artifact_upload_url_create`**
4. **HTTP PUT** tarball to **`upload_url`**
5. **`hosting_v1_apps_deployments_artifact_upload_complete_create`**
6. **`hosting_v1_apps_deployments_finalize_create`**

### 11.4 Storage REST list objects

**Path:** **`POST ${STORAGE_ORIGIN}/storage/v1/object/list/company`**

Body keys: **`GET ${STORAGE_ORIGIN}/api/schema/`** [storage-buckets].

## 12. Human CLI

**Login:**

```bash
shellui login
```

**Config keys** (see [backend sample][backend-json]):

- **`backend.url`:** regional identity origin.
- **`backend.companyId`:** regional tenant for login.
- **`saas.url`:** SaaS API base. Fallback env:
  **`SHELLUI_SAAS_URL`**. Dev default port **8005**.
- **`storage.url`:** storage service origin.
- **`hosting.url`:** hosting service origin.

**Commands map to HTTP** ([CLI][cli-root]). Each command prefixes the path with
the matching config **`backend.url`**, **`saas.url`**, **`storage.url`**, or
**`hosting.url`**.

- **`shellui companies list`:** `GET /api/v1/companies/`
- **`shellui projects list`:** `GET /api/v1/companies/`
- **`shellui projects endpoints`:** `GET /api/v1/companies/{uuid}/endpoints/`
- **`shellui storage buckets list`:** `GET /storage/v1/bucket`
- **`shellui hosting apps list`:** `GET /hosting/v1/apps`
- **`shellui deploy`:** preview bundle upload (not hosting MCP artifact flow)

## 13. Secrets and shell history

Use **`read -r -s VARIABLE`** then **`export VARIABLE`** so secrets are not
argv to **`curl`**. **`read -r -s`** reads one line with no echo. Avoid
**`export TOKEN=paste`** in shared examples. Prefer OS keychain [cli-login].

## 14. Settings UI activity labels

Shellui Settings maps outcomes to **`allowed`**, **`denied`**, **`failed`**,
**`pending_approval`**, **`session_used`**, **`unknown`** [activity-tsx]. Use
in-product navigation for approvals. Do not invent a **Settings** deep link in
docs.

## 15. OpenAPI and handbooks

- **Identity:** [MCP and agents][identity-mcp]
- **SaaS:** [docs/mcp.md][saas-mcp] (clone the repo; raw GitHub can 404)
- **Storage:** [MCP][storage-mcp]
- **Hosting:** [MCP][hosting-mcp]
- **Email:** [MCP][email-mcp]
- **AI:** [MCP gateway][ai-mcp]

**Schema:** **`GET ${ORIGIN}/api/schema/`** on each service.

## 16. Troubleshooting

- **Exchange `404`:** Confirm identity **region** role and **`GLOBAL_*`** env
  [identity-mcp].
- **Gateway `404` `company_required`:** Use **`/c/{id}/mcp`**, not plain
  **`/mcp`** [ai-mcp].
- **Wrong `aud`:** Mint for the exact **`{origin}/mcp`** or per-company AI URL.
- **Wrong company in URL:** Request gets **`401`** even when the JWT verifies
  [ai-mcp].
- **Pending forever:** Human **`decide`** or gateway **`deny`**; check
  **`expired`** [identity-mcp].
- **Revoked grant:** Global revoke webhook and regional pause block later
  exchange [identity-mcp]. **Reconnect** does not undo revoke. Re-authorize.

## Related

- [CLI](/cli)
- [SDK](/sdk)
- [Dev stack](/dev-stack)

[dev]: /dev-stack
[identity-mcp]: https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md
[ai-mcp]: https://github.com/shellui/ai-service/blob/develop/docs/mcp.md
[email-mcp]: https://github.com/shellui/email-service/blob/develop/docs/mcp.md
[hosting-mcp]: https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md
[storage-mcp]: https://github.com/shellui/storage-service/blob/develop/docs/mcp.md
[saas-mcp]: https://github.com/shellui/saas-service/blob/develop/docs/mcp.md
[storage-buckets]: https://github.com/shellui/storage-service/blob/develop/docs/buckets-and-objects.md
[gen-env]: https://github.com/shellui/shellui/blob/develop/dev/generate_env.py
[projects-js]: https://github.com/shellui/shellui/blob/develop/packages/cli/src/commands/projects.js
[activity-tsx]: https://github.com/shellui/shellui/blob/develop/packages/core/src/features/settings/components/McpAgentActivitySection.tsx
[cli-login]: /cli#shellui-login-root
[cli-projects]: /cli#shellui-projects-action-id-root
[cli-root]: /cli
[backend-json]: https://github.com/shellui/shellui/blob/develop/dev/config/shellui.backend.config.json
