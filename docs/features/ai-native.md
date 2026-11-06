---
title: AI native local MCP testing
sidebar_label: AI native platform
description: Local compose path for MCP OAuth, exchange, and gateway tools.
---

This page is a **local testing** path for developers running `shellui/dev` with
sibling service clones.
It complements the identity MCP reference [identity-mcp], not replace it.
For connector URL copy, see [AI native MCP](./ai-native-mcp).

## What this repo validates vs live on your machine

**What this repo validates:** `pnpm run test:scripts` (including `docker compose
config` when Docker is on the host),
`node scripts/verify-ai-native-doc.mjs`, and
`pnpm run docs:build`.

**Live on your machine:** human account and Terms in the dashboard, regional MCP
consent, `tools/call` through the AI gateway, and human approval in Settings.
The SaaS host may answer at **`http://localhost:8005/mcp`**, but the full global
agent path (mint after SaaS MCP consent, then regional exchange) is **not**
finished in SaaS until that gap closes
[identity-mcp].
CI here does not run that stack end to end; it does not drive a browser or mint
real agent JWTs.

**Gap (SaaS):** Your SaaS clone may still say global agent mint after SaaS MCP
consent is **not implemented in saas yet**; follow that repo for whether that
path is live.
Until it is, you cannot complete the full RFC 8693 exchange from a real global
agent JWT without a manual substitute (for example a test harness in your SaaS
clone).
Regional MCP OAuth (authorize, token, refresh) and regional human approvals on
identity are still the source-backed core for local testing.

**Inspected sources (fetch on this VM, read-only):** identity-service
**`d79d433278ac18695a6165448bf0b8cfe56c88a5`**, storage-service
**`310e29a6e2b96455fdb8dac4b077813d83a60396`**. There is no public GitHub repo
named **`shellui/saas-service`**, so a SaaS head was not cloned here; use your
local SaaS checkout when its global MCP behavior matters.

## Concepts you must keep separate

- **Global dashboard MCP** host in dev is **`http://localhost:8005`**.
  The full MCP JSON-RPC URL is **`http://localhost:8005/mcp`**.
  That surfaces **SaaS** global tools
  (for example **`list_services`**, **`api_v1_templates_list`**,
  **`api_v1_templates_render_preview`**, **`api_v1_companies_create`**,
  **`api_v1_companies_retrieve`**).
  It does **not** read application storage rows on behalf of a regional tenant
  by itself.
- **Regional application MCP** goes through the **AI gateway** per company:
  **`http://localhost:8006/c/<regional_company_id>/mcp`**.
  The integer is the identity company id, not the dashboard UUID [identity-mcp].
- **Human SSO** (`shellui login`, dashboard session) is **not** interchangeable
  with **MCP agent** bearer tokens.
  Agent bearer cannot call **`GET /api/v1/mcp/approvals`** or
  **`POST /api/v1/mcp/approvals/{id}/decide`**;
  those need a **human** company token [identity-mcp] [permissions-src].

## Preconditions

- Repos cloned beside **shellui**: **identity-service**, **saas-service**,
  **storage-service**, **hosting-service**, **email-service**,
  **ai-service**, plus front ends you need.
  Paths match [compose-yml].
- From **`shellui/dev`**: `./generate-env.sh` then `./start.sh` (or compose up).
  **`SHELLUI_INSTANCE_ROLE=region`**, **`GLOBAL_ISSUER_URL`**,
  **`GLOBAL_JWKS`**, and **`GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`** must reach
  identity or regional token exchange returns **404** [identity-mcp].
  Set **`GLOBAL_AGENT_SIGNING_KEY`** (and kid) per **`dev/.env.local.example`**
  so SaaS can mint the global agent JWT in branches where that path exists
  [compose-yml].
- **Identity port:** in **`dev/docker-compose.yml`** the identity service
  publishes **`- '8001:8000'`** [compose-yml].

## One bounded local testing sequence

Follow in order.

1. **Account and Terms:** create a **non-staff** member in the dashboard dev
   app, and accept Terms.
   Staff cannot finish MCP OAuth in the identity rules [identity-mcp].
2. **Regional MCP client (curl):** **`POST /oauth/mcp/register`** on
   **`http://localhost:8001`**, then build **`GET /oauth/mcp/authorize`** with PKCE
   S256 and
   **`resource=http://localhost:8006/c/<company_id>/mcp`**.
   Open the URL, approve consent (form fields include repeated **`services=`**,
   optional **`include_saas`**) [identity-mcp] [mcp-tok].
3. **Regional token:** **`POST /oauth/mcp/token`** with
   **`grant_type=authorization_code`** and the same **`resource`** as authorize
   [identity-mcp].
4. **Gateway:** **`POST http://localhost:8006/c/<company_id>/mcp`** with JSON-RPC
   **`tools/list`**, then **`tools/call`** using names from that list
   [identity-mcp].
   For storage list shapes, **`bucket_id`** in **`path_params`** follows
   **`ObjectListRequestSerializer`** [storage-serializer].
   **`storage_list_buckets`** appears in storage MCP tests [storage-test].
5. **Delegated downstream:** ai-service obtains downstream access via
   **`mcp-downstream-access-token`** on identity [identity-mcp].
6. **Human approval (regional writes):** when **`access_mode`** is **`ask`**,
   expect a pending row.
   Owners approve with **`POST /api/v1/mcp/approvals/{id}/decide`** and
   **`{"decision":"approve"}`** or **`"deny"`** [identity-mcp].
   **`GET /api/v1/mcp/approvals`** lists **`service`**, **`action`**,
   **`tool_name`**, **`target`**, **`is_destructive`**,
   **`short_action_summary`**, and **`arguments_redacted`**.
   For internal creates **`arguments_redacted` is always `{}`**. Ingest rejects
   **`arguments_redacted`** in the internal create body and clears legacy stored
   blobs [identity-mcp] [internal-approval].
7. **Session allow (non-destructive only):** the MCP client path uses
   **`allow_session`**
   (**`session_allow`** in chat metadata).
   Duration is **about 60s** per connection, driven by
   **`MCP_APPROVAL_SESSION_TTL_SECONDS`** (clamped **30** to **60**).
   This is **not** access token lifetime [identity-mcp].
8. **Destructive tools:** Identity **never** grants destructive tools without a
   separate human approval. Delegated regional JWTs keep **`mcp_destructive`**
   **`false`**.
   OAuth consent no longer enables **`destructive without asking`**, and
   Settings reject turning **`allow_destructive_without_asking`** on; legacy
   rows may still store the old flag until someone narrows the agent
   [identity-mcp].
9. **Activity in Shellui:** Settings surfaces agent activity via
   **`McpAgentActivitySection.tsx`** [activity-tsx].
   **Call logs** store **`outcome`** (for example **`allowed`**,
   **`pending_approval`**) and authoritative tool metadata; ingest rejects
   **`arguments`** and **`arguments_redacted`** so stored
   **`arguments_redacted`** stays **`{}`** [identity-mcp].

### Register

```bash
curl -sS -X POST "http://localhost:8001/oauth/mcp/register" \
  -H "Content-Type: application/json" \
  -d '{"client_name":"local_dev_agent","redirect_uris":
  ["http://localhost:8765/callback"]}'
```

### PKCE secret and challenge

```bash
V="$(openssl rand -base64 48 | tr -d '\n')"
D="$(printf '%s' "$V" | openssl dgst -binary -sha256 |
  openssl base64 | tr -d '\n')"
C="$(printf '%s' "$D" | tr '+/' '-_' | tr -d '=')"
```

### Authorize URL (replace placeholders)

Print the authorize URL with your **`client_id`**, **`state`**,
**`code_challenge`** (**`C`**), and **`company_id`**:

```bash
python3 - <<'PY'
import urllib.parse as u
q = dict(
  response_type="code",
  client_id="your_client_id_here",
  redirect_uri="http://localhost:8765/callback",
  scope="openid",
  state="your_state_here",
  code_challenge="your_code_challenge_here",
  code_challenge_method="S256",
  resource="http://localhost:8006/c/1/mcp",
)
base = "http://localhost:8001/oauth/mcp/authorize"
print(base + "?" + u.urlencode(q))
PY
```

### Token (authorization_code)

```bash
curl -sS -X POST "http://localhost:8001/oauth/mcp/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "client_id=your_client_id_here" \
  --data-urlencode "code=your_authorization_code_here" \
  --data-urlencode "redirect_uri=http://localhost:8765/callback" \
  --data-urlencode "code_verifier=$V" \
  --data-urlencode "resource=http://localhost:8006/c/1/mcp"
```

### Gateway tools list

```bash
read -r -s TOK
curl -sS -X POST "http://localhost:8006/c/1/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Global SaaS MCP (blocked on SaaS gap)

Do **not** treat the global path as a working end-to-end loop until SaaS
implements global agent mint after SaaS MCP consent; identity documents that
gap [identity-mcp]. When your SaaS clone is ready and documents
**`docs/global-mcp.md`**, use it for **`POST http://localhost:8005/mcp`**
(**`tools/list`**, **`api_v1_companies_create`** with **`"region":"ch"`**,
**`api_v1_companies_retrieve`**).
The **`aud`** on the global agent JWT is
**`GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`**
(see **`dev/.env.local.example`**), not **`http://localhost:8005/mcp`**
[identity-mcp].

After a real global agent token exists, RFC 8693 exchange to the regional
gateway uses **`POST /oauth/mcp/token`** on identity with
**`requested_token_type`** and **`subject_token_type`** set to
**`urn:ietf:params:oauth:token-type:access_token`**, plus **`grant_type`**
**`urn:ietf:params:oauth:grant-type:token-exchange`**
[identity-mcp].
Federation for humans uses **`POST /oauth/token`**
(**`handle_token_exchange`**), not agent exchange [identity-mcp].

## Failure and edge behaviors

- **Deny:** **`POST /api/v1/mcp/approvals/{id}/decide`** with **`"deny"`**
  [identity-mcp].
- **Pending:** identity pending rows expire after **10 minutes** [identity-mcp].
  A separate **600s to 900s** window may apply only to **setup** flows your
  **saas-service** branch defines; confirm in that repo.
  It is **not** the **`session_allow`** window.
- **Revocation:** **`POST /api/v1/mcp/agents/{id}/revoke`** and revocation
  polling in the identity handbook [identity-mcp].
- **Unavailable:** if identity is down, expect gateway and downstream calls to
  fail; services rely on identity for tokens and revocation [identity-mcp].

## shellui.config.json (CLI)

```json
{
  "backend": {
    "type": "shellui",
    "url": "http://localhost:8001",
    "companyId": "1"
  },
  "saas": { "url": "http://localhost:8005" }
}
```

**`REGION_CH_IDENTITY_ORIGIN`** labels the dashboard region row; **`saas.url`**
is still the base for **`GET /api/v1/companies/`** [projects-js].

## CLI routes (human session)

After **`shellui login`** (token not printed):

- **`shellui projects list`**: **`GET {saas.url}/api/v1/companies/`**
- **`shellui projects get <uuid>`**:
  **`GET {saas.url}/api/v1/companies/{uuid}/`**
- **`shellui projects regions`**: **`GET {saas.url}/api/v1/regions/`**
- **`shellui projects endpoints <uuid>`**:
  **`GET {saas.url}/api/v1/companies/{uuid}/endpoints/`**
- **`shellui projects use <uuid>`**: stores default UUID for endpoints
- **`shellui projects create`**: **not** implemented (**`projects create`**)
  [projects-js]

## Reference links

[start-sh]: https://github.com/shellui/shellui/blob/cursor/dev-saas-cors-ai-native-guide-0ef6/dev/start.sh
[compose-yml]: https://github.com/shellui/shellui/blob/cursor/dev-saas-cors-ai-native-guide-0ef6/dev/docker-compose.yml
[projects-js]: https://github.com/shellui/shellui/blob/cursor/dev-saas-cors-ai-native-guide-0ef6/packages/cli/src/commands/projects.js
[identity-mcp]: https://github.com/shellui/identity-service/blob/d79d433278ac18695a6165448bf0b8cfe56c88a5/docs/mcp-and-agents.md
[mcp-tok]: https://github.com/shellui/identity-service/blob/d79d433278ac18695a6165448bf0b8cfe56c88a5/apps/agents/oauth_views.py
[decide-src]: https://github.com/shellui/identity-service/blob/d79d433278ac18695a6165448bf0b8cfe56c88a5/apps/agents/admin_views.py
[permissions-src]: https://github.com/shellui/identity-service/blob/d79d433278ac18695a6165448bf0b8cfe56c88a5/apps/agents/permissions.py
[internal-approval]: https://github.com/shellui/identity-service/blob/d79d433278ac18695a6165448bf0b8cfe56c88a5/apps/agents/internal_views.py
[storage-serializer]: https://github.com/shellui/storage-service/blob/310e29a6e2b96455fdb8dac4b077813d83a60396/apps/storage/serializers.py
[storage-test]: https://github.com/shellui/storage-service/blob/310e29a6e2b96455fdb8dac4b077813d83a60396/apps/storage/tests/test_mcp.py
[email-schema]: https://github.com/shellui/email-service/blob/develop/apps/email/schema.py
[activity-tsx]: https://github.com/shellui/shellui/blob/cursor/dev-saas-cors-ai-native-guide-0ef6/packages/core/src/features/settings/components/McpAgentActivitySection.tsx
