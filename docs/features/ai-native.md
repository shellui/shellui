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

## Handbook anchors and remote heads

Stable handbook links use **`develop`** on GitHub. For issue review **135**,
handbook text for OAuth, global exchange, approvals, and call logs matches
**identity-service** commit **`6a271764f0132a27d979945663a20380cfb94a68`**
[identity-mcp]. **storage-service** and **hosting-service** serializers and dev
notes for the same review sit at **`c2cb6ef05f5b5f697d15f849167c16c009885072`**
and **`71403d9c3cd6ffa3a0ee6d561662070ad31e0581`** [storage-serializer]
[storage-test].

Remote default branch tips from **`git ls-remote`** on this VM (2026-11-06):

- **identity-service**
  **`f669ddda6491faf77ebb8d87261eb4b4b0204e71`**
- **storage-service**
  **`17df0791ef0b8c91a31ac2a16fe9283a9556f75f`**
- **hosting-service**
  **`8015c0a28765ddda3fcc2653a10ef5368a7604d5`**
- **email-service**
  **`919bcf7d7977ddc825ac415388638fca1714c99c`**
- **ai-service**
  **`73ec12f0648fda69266b369f3e5b1c2fef1474ae`**

**saas-service** is not available to this agent, so SaaS code and docs paths are
not verified here. Use your org checkout for SaaS mint details.

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

- **Global agent RFC 8693:** Identity documents **`POST /oauth/token`** token
  exchange from a global agent JWT to a regional MCP resource when
  **`SHELLUI_INSTANCE_ROLE=region`** and **`GLOBAL_ISSUER_URL`**,
  **`GLOBAL_JWKS`**, and **`GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`** are set
  [identity-mcp]. SaaS mints the global subject JWT; confirm variable names and
  mint steps from your **`saas-service`** checkout. This monorepo does not run a
  full mint plus exchange proof in CI.
- **Global approval forwarding:** delegated agents (**`global_agent_id`**) must
  route internal approvals through **ai-service**; storage, hosting, and email
  get **409** **`out_of_sync`** if they create approvals directly
  [identity-mcp]. Remaining product gaps for global versus regional admin flows
  are tracked in SaaS issue **34**; treat those paths as uncertain until that
  issue closes.

## Install and start (**Shellui** `develop`)

Clone repos side by side and run **`shellui/dev`**: see [dev-stack]. Then:

```bash
cd shellui/dev
./start.sh
```

`start.sh` runs **`generate-env.sh`** then **`docker compose --env-file
.env.local up --build`** [start-sh] [compose-yml]. Identity maps
**`- '8001:8000'`** [compose-yml]. **hosting** publishes **`8003:8000`** on the
host [compose-yml].

Set **`SHELLUI_INSTANCE_ROLE=region`**, **`GLOBAL_ISSUER_URL`**,
**`GLOBAL_JWKS`**, and **`GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`** or regional
**token exchange** answers **404** [identity-mcp].

**`GLOBAL_JWKS` and signing key:**
`dev/generate_env.py` derives **`GLOBAL_JWKS`** and **`GLOBAL_AGENT_KEY_ID`**
from the same **`GLOBAL_AGENT_SIGNING_KEY`** PEM on every run so Identity
offline verify and SaaS mint cannot drift [generate-env] [compose-yml].

**`dev/docker-compose.yml`** passes **`GLOBAL_AGENT_SIGNING_KEY`**,
**`GLOBAL_AGENT_KEY_ID`**, and **`GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`** into
**saas** [compose-yml]. **`GLOBAL_AGENT_KEY_ID`** equals the **`kid`** in
**`GLOBAL_JWKS`** (single-key JWKS object) [generate-env].

If you replace the signing material by hand, keep **`GLOBAL_JWKS`** in sync with
the key **SaaS** and **identity** use (same **`kid`**, **`n`**, and **`e`**), or
rerun **`generate-env.sh`**.

## Human account and Terms before agent work

Use a **normal member** account for MCP OAuth, not **staff**. [dev-stack] seeds
**`dev@localhost`** for company **1** with the email link. Open Mailpit, finish
sign-in, then use MCP **`/oauth/mcp/authorize`**. **`admin` / `admin`** is only
for Django admin (`http://localhost:8001/admin/`). Staff cannot use the email
link and cannot authorize MCP clients [identity-mcp] [dev-stack]. Accept any
**Terms** or similar prompts Identity shows during that browser flow. Wording
comes from the running identity build. Do not route agent OAuth through the
staff admin shortcut.

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
connector URL into your MCP product or run [ai-e2e] against **ai-service**
**`develop`** [identity-mcp].

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
  **`short_action_summary`**, and **`arguments_redacted`** (always **`{}`** for
  internal creates) [identity-mcp].
- **Decide:** **`POST /api/v1/mcp/approvals/{id}/decide`** with
  **`{"decision":"approve"}`** or **`"deny"`** [identity-mcp].
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

## Activity, call logs, and revocation

**`POST /api/v1/mcp/internal/mcp-call-logs`** requires **`outcome`** in
**`allowed`**, **`failed`**, **`denied`**, **`waiting_approval`**, or
**`session_used`**. **`company_id`** and **`grant_version`** (JSON integer,
match the **`Agent`**) are required. Delegated agents also send
**`global_company_id`** (uuid) and **`company_binding_version`** (JSON
integer) matching the row. Identity rejects **`arguments`**,
**`arguments_redacted`**, and client-supplied **`operation_title`** /
**`resource_label`**; it derives labels from **`tool`**, **`method`**,
**`path`**, **`service`** [identity-mcp].

Revoke agents with **`POST /api/v1/mcp/agents/{id}/revoke`** and poll
**`GET /api/v1/mcp/internal/mcp-revocations`** as in [identity-mcp].

## Global token exchange (fields)

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
- **saas-service** mint, webhooks, and dashboard flows must be validated from
  your private checkout and SaaS docs.

## Reference links

[dev-stack]: https://github.com/shellui/shellui/blob/develop/docs/dev-stack.md
[start-sh]: https://github.com/shellui/shellui/blob/develop/dev/start.sh
[compose-yml]: https://github.com/shellui/shellui/blob/develop/dev/docker-compose.yml
[generate-env]: https://github.com/shellui/shellui/blob/develop/dev/generate_env.py
[projects-js]: https://github.com/shellui/shellui/blob/develop/packages/cli/src/commands/projects.js
[identity-mcp]: https://github.com/shellui/identity-service/blob/6a271764f0132a27d979945663a20380cfb94a68/docs/mcp-and-agents.md
[ai-mcp]: https://github.com/shellui/ai-service/blob/develop/docs/mcp.md
[ai-e2e]: https://github.com/shellui/ai-service/blob/develop/docs/mcp-e2e-conformance.md
[mcp-tok]: https://github.com/shellui/identity-service/blob/6a271764f0132a27d979945663a20380cfb94a68/apps/agents/oauth_views.py
[decide-src]: https://github.com/shellui/identity-service/blob/6a271764f0132a27d979945663a20380cfb94a68/apps/agents/admin_views.py
[permissions-src]: https://github.com/shellui/identity-service/blob/6a271764f0132a27d979945663a20380cfb94a68/apps/agents/permissions.py
[internal-approval]: https://github.com/shellui/identity-service/blob/6a271764f0132a27d979945663a20380cfb94a68/apps/agents/internal_views.py
[storage-serializer]: https://github.com/shellui/storage-service/blob/c2cb6ef05f5b5f697d15f849167c16c009885072/apps/storage/serializers.py
[storage-test]: https://github.com/shellui/storage-service/blob/c2cb6ef05f5b5f697d15f849167c16c009885072/apps/storage/tests/test_mcp.py
[activity-tsx]: https://github.com/shellui/shellui/blob/develop/packages/core/src/features/settings/components/McpAgentActivitySection.tsx
