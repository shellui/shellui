---
title: AI native local MCP testing
sidebar_label: AI native platform
description: Local compose path for MCP OAuth, gateway tools, and approvals.
---

Run **Shellui** **`shellui/dev`** next to sibling service repos, then test
**regional** MCP on the ai gateway with **curl** and a browser. This page adds
Shellui-specific **startup** and **CLI** notes. Identity owns OAuth semantics
[identity-mcp]. The gateway owns **`tools/list`**, approvals, and
**`session_allow`** rules [ai-mcp].

Use [AI native MCP](./ai-native-mcp) only for short connector URL pointers.

## What this repo validates vs what you run locally

**What this repo validates:** `pnpm run test:scripts` (including `docker compose
config` when Docker is on the host),
`node scripts/verify-ai-native-doc.mjs`, and `pnpm run docs:build`.

**Live on your machine:** after compose from **`shellui/dev`**, you can drive
regional OAuth, **`tools/list`** on **`http://localhost:8006/c/`**, human
**`GET /api/v1/mcp/approvals`**, **`POST /api/v1/mcp/approvals/`** **`{id}`**
**`/decide`**, activity in **`McpAgentActivitySection.tsx`**, and SaaS
**`http://localhost:8005/mcp`** when your **`saas-service`** checkout is on the
wire [identity-mcp] [activity-tsx].

CI in this monorepo does not run that stack end to end or mint real JWTs.

## Source pins (read on this VM)

These SHAs match the open PR heads you listed:

- **identity-service** branch head:
  **`d79d433278ac18695a6165448bf0b8cfe56c88a5`** [identity-mcp]
- **storage-service** branch head:
  **`a470938a76f453048acba61661847aa88466c318`** [storage-serializer]
  [storage-test]
- **hosting-service** branch head:
  **`cdd1c3a57d308c0bae7ea12f9618ed04f830c077`**
- **email-service** branch head:
  **`17c900d07938f5fbd15a0241ba6e58d8a704c9d0`**
- **ai-service** branch head: **`6eb54d3a887a4db9f02743533388aa7e51ce3d8d`**
  [ai-mcp] [ai-e2e]

**saas-service** is a **private** org repo on GitHub. This environment cannot
clone it; use your org checkout when you verify **`GLOBAL_AGENT_SIGNING_KEY`**
mint and **`POST http://localhost:8005/mcp`**. Some internal docs still say
global agent mint after SaaS MCP consent is **not implemented in saas yet**;
until your SaaS branch closes that, treat **global agent JWT then regional RFC
8693 token exchange** as **not** supported end to end in public copy here
[identity-mcp].

## Global vs regional (no master token)

- **Global:** **`POST http://localhost:8005/mcp`** surfaces SaaS tools such as
  **`list_services`**, **`api_v1_templates_list`**,
  **`api_v1_templates_render_preview`**, **`api_v1_companies_create`**, and
  **`api_v1_companies_retrieve`**. **`list_services`** returns each service
  **`/mcp`** origin Identity expects for downstream minting [identity-mcp].

- **Regional:** **`POST http://localhost:8006/c/<regional_company_id>/mcp`**
  is the only supported gateway path per company. Plain
  **`POST http://localhost:8006/mcp`** answers **404** with **`company_required`**
  [ai-mcp].

- **Token scope:** access token **`aud`** must match the gateway URL you call.
  There is **no** one token that replaces per-company URLs [ai-mcp].

- **Humans vs agents:** **`GET /api/v1/mcp/approvals`** and approval decide
  routes need a **human** company token, not agent Bearer [identity-mcp]
  [permissions-src].

## Install and start (**Shellui** `develop`)

Clone repos side by side and run **`shellui/dev`**: see [dev-stack]. Then:

```bash
cd shellui/dev
./start.sh
```

`start.sh` runs **`generate-env.sh`** then **`docker compose --env-file
.env.local up --build`** [start-sh] [compose-yml]. Identity maps
**`- '8001:8000'`** [compose-yml].

Set **`SHELLUI_INSTANCE_ROLE=region`**, **`GLOBAL_ISSUER_URL`**,
**`GLOBAL_JWKS`**, and **`GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`** or regional
**token exchange** answers **404** [identity-mcp]. For SaaS that mints global
agent JWTs, set **`GLOBAL_AGENT_SIGNING_KEY`** (and kid) per
**`dev/.env.local.example`** [compose-yml].

## Human account and Terms before agent work

Create a **non-staff** dashboard member and accept Terms. Staff cannot finish
MCP OAuth on Identity [identity-mcp].

## Official MCP clients (supported where documented)

The ai-service repo ships **`./tools/mcp-e2e/run.sh`**, which runs **identity**,
**ai-service**, **postgres**, **redis**, and **saas-mock** only. It proves:

- **`@modelcontextprotocol/sdk`** (TypeScript) with registration,
  **`GET /.well-known/oauth-protected-resource/c/<company_id>/mcp`**, PKCE S256,
  **`POST /oauth/mcp/token`**, refresh, **`initialize`**, **`tools/list`**, and
  a harmless **`tools/call`**
- official **Python `mcp`** with the same flow
- **`@modelcontextprotocol/inspector --cli`** for **`tools/list`** with the
  OAuth access token [ai-e2e]

That job **empties** storage, hosting, and email URLs on purpose. It is **not**
proof of **`shellui/dev`** with every sibling [ai-e2e].

**Shellui** does **not** ship a second scripted Inspector run on top of the full
**`shellui/dev`** stack; after **`shellui login`**, you paste the per-company
connector URL into your MCP product or run [ai-e2e] against clones at the pin
above [identity-mcp].

## Regional **curl** (**POST /oauth/mcp/register** onward)

Use **one** loopback **`redirect_uri`** in **`POST /oauth/mcp/register`**, the
**`GET /oauth/mcp/authorize`** query, and the token step. Identity compares the
value to the registered list exactly [identity-mcp].

### Register

```bash
curl -sS -X POST "http://localhost:8001/oauth/mcp/register" \
  -H "Content-Type: application/json" \
  -d '{"client_name":"local_dev_agent","redirect_uris":
  ["http://localhost:8765/callback"]}'
```

### PKCE verifier and challenge

```bash
V="$(openssl rand -base64 48 | tr -d '\n')"
D="$(printf '%s' "$V" | openssl dgst -binary -sha256 |
  openssl base64 | tr -d '\n')"
C="$(printf '%s' "$D" | tr '+/' '-_' | tr -d '=')"
```

### Authorize URL (fill placeholders)

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
  resource="http://localhost:8006/c/1234567890123/mcp",
)
print("http://localhost:8001/oauth/mcp/authorize?" + u.urlencode(q))
PY
```

Open the URL, sign in, approve consent (repeated **`services=`**, optional
**`include_saas`**) [identity-mcp] [mcp-tok].

### Token (**`/oauth/mcp/token`**)

Authorization server metadata lists **`POST /oauth/token`**.
**`POST /oauth/mcp/token`** is the same MCP handler [identity-mcp].

```bash
curl -sS -X POST "http://localhost:8001/oauth/mcp/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "client_id=your_client_id_here" \
  --data-urlencode "code=your_authorization_code_here" \
  --data-urlencode "redirect_uri=http://localhost:8765/callback" \
  --data-urlencode "code_verifier=$V" \
  --data-urlencode "resource=http://localhost:8006/c/1234567890123/mcp"
```

### Gateway **`tools/list`**

```bash
read -r -s regional_agent_access_token_here
curl -sS -X POST "http://localhost:8006/c/1234567890123/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $regional_agent_access_token_here" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Exported names are prefixed (for example **`storage_list_buckets`**) [ai-mcp].
Storage list **`path_params`** use **`bucket_id`** with
**`ObjectListRequestSerializer`** [storage-serializer].

## Downstream mint (**`mcp-downstream-access-token`**)

The gateway calls **`POST /api/v1/mcp/internal/mcp-downstream-access-token`**
on Identity with an ai-service RS256 assertion when it reaches another service
**`/mcp`** resource [identity-mcp].

## Approvals (**`allow_session`**, destructive)

- **List:** **`GET /api/v1/mcp/approvals`**. Pending rows list **`service`**,
  **`action`**, **`tool_name`**, **`target`**, **`is_destructive`**,
  **`short_action_summary`**, and **`arguments_redacted`**. Internal rows keep
  **`arguments_redacted` as `{}`** [identity-mcp].
- **Decide:** **`POST /api/v1/mcp/approvals/{id}/decide`** with **`approve`** or
  **`deny`** [identity-mcp].
- **Gateway retries:** **`allow_session`** (**`session_allow`** in chat
  metadata) is for **non-destructive** tools; default session TTL is **about
  60s** via **`MCP_APPROVAL_SESSION_TTL_SECONDS`** (clamped **30** to **60**)
  [identity-mcp] [ai-mcp].
- **Destructive:** **`session_allow` never** applies when the tool is
  destructive; **`mcp_access` `ask`** still requires approval for destructive
  tools even when **`full`** would allow non-destructive writes [ai-mcp].
  Identity rejects OAuth **"destructive without asking"** for new consent and
  keeps delegated **`mcp_destructive`** aligned with that rule [identity-mcp].
- **Legacy:** **`allow_destructive_without_asking`** may remain on old
  **`Agent`** rows [identity-mcp].

## Activity and revocation

Call log ingest rejects **`arguments`** and **`arguments_redacted`** bodies so
stored **`arguments_redacted` stays `{}`** [identity-mcp]. Revoke agents with
**`POST /api/v1/mcp/agents/{id}/revoke`** and poll
**`GET /api/v1/mcp/internal/mcp-revocations`** as in [identity-mcp].

## Global token exchange (reference fields only)

When a **real** global agent JWT exists, **`POST /oauth/mcp/token`** on Identity
(or **`POST /oauth/token`**, same handler) carries **`grant_type`**
**`urn:ietf:params:oauth:grant-type:token-exchange`**, **`subject_token`**,
**`requested_token_type`** and **`subject_token_type`**
**`urn:ietf:params:oauth:token-type:access_token`**, and **`resource`** set to
**`http://localhost:8006/c/<id>/mcp`** [identity-mcp]. Human vault federation
still uses **`handle_token_exchange`** on **`POST /oauth/token`**, not agent
exchange [identity-mcp]. Global agent **`aud`** is
**`GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`**, not **`http://localhost:8005/mcp`**
[identity-mcp]. Example SaaS create still sends **`"region":"ch"`** on
**`api_v1_companies_create`** next to **`api_v1_companies_retrieve`**
[identity-mcp].

## **`shellui.config.json`** (human CLI)

```json
{
  "backend": {
    "type": "shellui",
    "url": "http://localhost:8001",
    "companyId": "1234567890123"
  },
  "saas": { "url": "http://localhost:8005" }
}
```

**`REGION_CH_IDENTITY_ORIGIN`** labels the dashboard region row; **`saas.url`**
is the base for **`GET /api/v1/companies/`** [projects-js].

## Shellui CLI routes (human session)

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

## Not covered as a one-command flow here

- **Full** **`@modelcontextprotocol/inspector --cli`** against **`shellui/dev`**
  with scripted OAuth (beyond [ai-e2e] or a manual connector) is **not** in this
  repo.
- **saas-service** behavior must be validated from your private checkout.

## Reference links

[dev-stack]: https://github.com/shellui/shellui/blob/develop/docs/dev-stack.md
[start-sh]: https://github.com/shellui/shellui/blob/develop/dev/start.sh
[compose-yml]: https://github.com/shellui/shellui/blob/develop/dev/docker-compose.yml
[projects-js]: https://github.com/shellui/shellui/blob/develop/packages/cli/src/commands/projects.js
[identity-mcp]: https://github.com/shellui/identity-service/blob/d79d433278ac18695a6165448bf0b8cfe56c88a5/docs/mcp-and-agents.md
[ai-mcp]: https://github.com/shellui/ai-service/blob/6eb54d3a887a4db9f02743533388aa7e51ce3d8d/docs/mcp.md
[ai-e2e]: https://github.com/shellui/ai-service/blob/6eb54d3a887a4db9f02743533388aa7e51ce3d8d/docs/mcp-e2e-conformance.md
[mcp-tok]: https://github.com/shellui/identity-service/blob/d79d433278ac18695a6165448bf0b8cfe56c88a5/apps/agents/oauth_views.py
[decide-src]: https://github.com/shellui/identity-service/blob/d79d433278ac18695a6165448bf0b8cfe56c88a5/apps/agents/admin_views.py
[permissions-src]: https://github.com/shellui/identity-service/blob/d79d433278ac18695a6165448bf0b8cfe56c88a5/apps/agents/permissions.py
[internal-approval]: https://github.com/shellui/identity-service/blob/d79d433278ac18695a6165448bf0b8cfe56c88a5/apps/agents/internal_views.py
[storage-serializer]: https://github.com/shellui/storage-service/blob/a470938a76f453048acba61661847aa88466c318/apps/storage/serializers.py
[storage-test]: https://github.com/shellui/storage-service/blob/a470938a76f453048acba61661847aa88466c318/apps/storage/tests/test_mcp.py
[activity-tsx]: https://github.com/shellui/shellui/blob/develop/packages/core/src/features/settings/components/McpAgentActivitySection.tsx
