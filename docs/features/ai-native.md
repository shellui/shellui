---
title: AI native platform (global SaaS MCP, regional gateway, human CLI)
sidebar_label: AI native platform
description: Global SaaS MCP, regional gateway, OAuth, approvals, human CLI, SDK, and service handbooks on develop.
---

## Overview

Use this page when you wire **MCP agents** (OAuth and `tools/call`), **human** flows (shell, dashboard, CLI), or **iframe apps** (`@shellui/sdk`). Sources: **`develop`** on **shellui**, **identity-service**, **saas-service**, **ai-service**, and regional services.

**At a glance**

- **Global control plane (SaaS host):** dashboard companies (UUID), regions, endpoints, **`POST …/mcp`**, global tool approvals, OAuth metadata under **`/.well-known/*`** and **`/oauth/mcp/*`**
- **Regional data plane:** identity (people, JWTs), storage, hosting, email, each with **`POST …/mcp`**; **ai-service** aggregates tools at **`POST …/c/<regional_company_id>/mcp`**
- **Two company ids:** regional **decimal** (JWT `company_id`, `shellui companies get 1`) vs **dashboard UUID** on SaaS (`shellui projects get <uuid>`). Do not mix them
- **Human CLI** uses identity OAuth (`shellui login`). **MCP agents** use separate OAuth clients and tokens. **`@shellui/sdk`** uses the forwarded **regional human** session, not an agent JWT

Jump: [What you can build](#what-you-can-build) · [Identifiers](#identifiers-and-where-they-appear) · [Global vs regional OAuth](#global-saas-mcp-and-oauth) · [First company](#first-company-and-global-approval) · [CLI](#human-cli) · [SDK vs MCP](#sdk-iframe-apps-human-session) · [Activity](#activity-rows-settings) · [FAQ](#faq)

## What you can build

| Goal                                                                | Surface                                                                              | Notes                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| First **dashboard** company, regions, endpoints                     | Global SaaS **`POST …/mcp`** or REST                                                 | Control-plane only                                                                  |
| **Regional** MCP against one tenant (storage, hosting, email tools) | **`POST {AI_URL}/c/<regional_company_id>/mcp`** (or direct service **`POST …/mcp`**) | **`company_id`** in the agent token must match **`regional_company_id`** in the URL |
| Upload objects with the signed-in human in an iframe                | **`@shellui/sdk`** after `shellui.init()`                                            | Same regional session as the shell, not MCP                                         |
| Preview deploy from CI                                              | **`SHELLUI_DEPLOY_TOKEN`** and **`shellui deploy`**                                  | Not a login or MCP token                                                            |

## Identifiers and where they appear

| Kind              | Format         | Example                                | Where                                                                                                                                  |
| ----------------- | -------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Regional tenant   | Decimal string | `1`                                    | JWT `company_id`, `GET {identity}/api/v1/companies/`, **`POST {AI_URL}/c/1/mcp`**                                                      |
| Dashboard company | UUID           | `550e8400-e29b-41d4-a716-446655440000` | SaaS company records, `shellui projects list`                                                                                          |
| Link between them | SaaS field     | **`regional_company_id`**              | **`Company`** in SaaS (numeric when provisioned; empty until bind completes). Ai gateway URL uses this **decimal** value, not the UUID |

## Preconditions

1. **Non-staff** human member. Staff cannot complete MCP OAuth ([identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md))
2. **Terms of Service** and other **global** gates your operator configures are satisfied before you create dashboard companies, bind regions, or authorize MCP agents
3. Do not reuse **deploy tokens** (`SHELLUI_DEPLOY_TOKEN`) or **CLI login** tokens as MCP agent credentials

## Local URLs

From [`dev/docker-compose.yml`](https://github.com/shellui/shellui/blob/develop/dev/docker-compose.yml) and [`dev/.env.local.example`](https://github.com/shellui/shellui/blob/develop/dev/.env.local.example):

| Service                 | URL                     |
| ----------------------- | ----------------------- |
| Shell                   | `http://localhost:4000` |
| identity                | `http://localhost:8001` |
| storage                 | `http://localhost:8002` |
| hosting                 | `http://localhost:8003` |
| email                   | `http://localhost:8004` |
| SaaS                    | `http://localhost:8005` |
| ai gateway              | `http://localhost:8006` |
| Global dashboard (Vite) | `http://localhost:5174` |

SaaS browser calls must satisfy **`SAAS_CORS_ALLOWED_ORIGINS`** ([Local dev stack](/dev-stack#saas-api-cors)). **CORS** filters **browser** origins; it does not replace **Bearer** checks or membership. Inter-container bases use `http://<name>:8000`.

## Local dev prerequisites (this repo)

From [`dev/docker-compose.yml`](https://github.com/shellui/shellui/blob/develop/dev/docker-compose.yml):

- **saas-service** sets **`DASHBOARD_PUBLIC_URL: ${PUBLIC_SAAS_URL}`** (SaaS **API** base, for example `http://localhost:8005`, not the dashboard Vite URL)
- **identity** sets **`PROVISIONING_ISSUER: ${PUBLIC_SAAS_URL}`** and **`PROVISIONING_PUBLIC_KEY: ${PROVISIONING_PUBLIC_KEY}`** for provisioning assertions
- Run **`./generate-env.sh`** in **`dev/`** so **[`dev/generate_env.py`](https://github.com/shellui/shellui/blob/develop/dev/generate_env.py)** fills **`dev/.env.local`** from **[`dev/.env.local.example`](https://github.com/shellui/shellui/blob/develop/dev/.env.local.example)**: RS256 placeholders for JWT, per-service internal signing keys, **`PROVISIONING_PUBLIC_KEY`**, and related secrets. **Never commit** **`.env.local`**.

**Global agent signing and JWKS:** **`GLOBAL_ISSUER_URL`**, **`GLOBAL_JWKS`**, **`GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`**, and matching keys on **saas-service** are defined in **identity-service** and **saas-service** on **`develop`**. This compose file does not enumerate every global-agent variable; align those services with the same `develop` revision when you test [Global agent token exchange](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md) end to end.

## Mental model

**Global plane (SaaS):** dashboard **UUID** companies, regions, endpoints, **`POST /mcp`**, OAuth under **`/.well-known/...`** and **`/oauth/mcp/...`**. Global tools operate on **control-plane** data, not object bytes in storage.

**Regional plane:** identity, storage, hosting, email each expose **`POST /mcp`**. **ai-service** exposes **`POST /c/<regional_company_id>/mcp`** and names downstream tools `service_toolname` (one underscore). **`POST http://localhost:8006/mcp`** without a company segment returns **`404`** `company_required` ([ai MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)).

**Setup context:** after SaaS provisions a dashboard **Company**, the **numeric** regional tenant is **`regional_company_id`** on that **Company** (see [First company](#first-company-and-global-approval)). **Setup grants** and **server-side** setup context for tools are derived from that binding, not from a UUID you pass as `company_id` on the gateway.

**Human CLI:** `shellui login` stores an OAuth session for **identity**. Commands call identity or SaaS with that **Bearer**. They do not speak MCP JSON-RPC.

## Global SaaS MCP and OAuth

**JSON-RPC MCP** lives at **`POST https://<saas>/mcp`**, not under **`/oauth/mcp`**.

### Global consent on SaaS (human Bearer, POST)

On **saas-service** **`develop`**, **`apps/agents/oauth_views.py`** exposes **`mcp_authorize`** with **`require_POST`**. The client sends **JSON** (not a bare browser **GET** on this host):

- **`client_id`**, **`redirect_uri`**
- **`code_challenge`**, **`code_challenge_method`:** **`S256`**
- Optional: **`state`**, **`company_id`**, **`agent_name`**, **`access_mode`**, **`read_level`**, **`allow_destructive`**, **`services`**
- **`Authorization: Bearer`** with an **identity human** access token: accepted **ToS**, **non-staff**

The response includes **`redirect_to`** with **`code`** and **`state`** for your registered **`redirect_uri`**. Exchanging **`authorization_code`:** **`POST https://<saas>/oauth/mcp/token`** with **`grant_type=authorization_code`**, **`code`**, **`client_id`**, **`redirect_uri`**, **`code_verifier`**.

`GET` **`https://<saas>/oauth/mcp/authorize`** may exist for metadata or other flows; **do not** assume a generic MCP client can finish **global** consent with **GET-only** steps if your deployment’s source requires this **POST**.

### Regional MCP on identity (browser GET)

The **standard** regional flow is **`GET https://<identity>/oauth/mcp/authorize`** with PKCE **S256** and RFC 8707 **`resource={...}/mcp`**, then **`POST /oauth/mcp/token`**, as in [identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md). That path is **not** the same as global SaaS **POST** consent above.

### Tokens after consent

The **`authorization_code`** exchange yields a **global agent access** JWT from the **SaaS** issuance rules on your build. **Do not** document a generic **global-agent refresh** grant here; read **saas-service** and **identity-service** OpenAPI on **`develop`**.

**Regional** agent access and refresh for **`POST …/oauth/mcp/token`** follow [identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md).

### Global agent to regional exchange (RFC 8693)

To call the **ai gateway** with a **global** agent token, use OAuth 2.0 Token Exchange on **identity** at **`POST /oauth/mcp/token`**. **Resource URL** for the delegated gateway is:

**`{AI_PUBLIC_URL}/c/<regional_company_id>/mcp`**

Use the **numeric** **`regional_company_id`** from the SaaS **Company**, not the dashboard UUID. **`company_id`** in the exchange body is that same regional tenant. Narrowing fields (**`access_mode`**, **`read_level`**, **`allow_destructive`**, **`services`**) and offline verification of the subject token (**`iss`**, **`aud`**, **`exp`**, **`jti`**) are defined in [Global agent token exchange](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md). Follow that handbook and your deployment’s final code; do not copy a partial JSON example as your production contract.

## First company and global approval

**Tool name:** **`api_v1_companies_create`** (confirm with **`tools/list`** on **`POST http://localhost:8005/mcp`**).

1. Agent calls **`tools/call`** with arguments from **OpenAPI**
2. Pending shape: **`status`** **`pending`**, **`approval_id`** in **`result.meta`** (see [saas-service **`docs/mcp.md` on `develop`**](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md))
3. Human decides on **SaaS** with an **identity** human **Bearer**:

```http
POST /api/v1/mcp/approvals/{approval_uuid}/decision
Authorization: Bearer your_identity_human_access_token_here
Content-Type: application/json
```

```json
{
  "decision": "approve",
  "session_allow": false
}
```

4. Agent **retries the same** **`tools/call`** with **identical** arguments. **SaaS** consumes the **single-use** approval, provisions the **Company**, and binds **global** agent setup context **server-side**
5. Read the **numeric** regional tenant from **`regional_company_id`** on the **Company** in the SaaS **serializer** response (or **list** / **get** when active). It is **empty** until provision succeeds. **Do not** treat **`setup_context_company_id`** as something you paste from an untrusted client; it is **trusted server-side** context aligned with **`Company.regional_company_id`**
6. **Setup window:** **new-company** setup authority uses an **absolute 12 minute** ceiling on the **setup grant**. **Non-destructive** **session allow:** if **more than 600 seconds** remain on that grant, session allow may run in a **600 to 900 second** range as the server configures; if **600 seconds or less** remain, the **ordinary 60 second** **non-destructive** session rule applies, still capped by **access** and **setup** expiry, same **`Mcp-Session-Id`**. **Explicit deny** wins. **Destructive** tools require a **fresh individual** approval in **every** access mode and **cannot** use **`allow_session`**. Confirm exact timers against **identity** and **saas-service** **`develop`** on your branch

**Not the same clock:** the **12 minute** setup policy is not the same as **`exp`** on a JWT. Compare claims only for the issuer that minted them.

## Global MCP URL in Settings

Identity may return **`global_mcp_url`**. This repo validates it as a full **`https://host/mcp`** (or **`http://…/mcp`**) URL in [`parseValidatedGlobalMcpEndpointUrl`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/personalAgentsApi.ts). It is **discovery** for **which** MCP endpoint to show. It does **not** by itself grant consent, rotate tokens, or replace **OpenAPI**.

**`grant_version`**, **`company_binding_version`**, **`setup_expires_at`**, and similar fields are **live authority** or **signed-proof** data on tokens and internal APIs where the service exposes them. They are **not** a guaranteed part of the **personal status** blob for every session. Read **identity-service** and **saas-service** **`develop`** for the response you run.

## Regional MCP (ai gateway)

**Metadata:**

```http
GET http://localhost:8006/.well-known/oauth-protected-resource/c/2/mcp
```

**Streamable HTTP:**

```http
POST http://localhost:8006/c/2/mcp
```

Replace **`2`** with your **`regional_company_id`**. Token **`aud`** must equal that resource URL and **`company_id`** must match the path.

Optional query for SaaS at consent: metadata may include **`shellui_mcp_authorize_query: {"saas_offered":"1"}`** so clients add **`saas_offered=1`** on **`GET /oauth/mcp/authorize`** ([ai MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)).

## Regional service MCP

| Service | Handbook                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------ |
| Storage | [storage **`docs/mcp.md`**](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md) |
| Hosting | [hosting **`docs/mcp.md`**](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md) |
| Email   | [email **`docs/mcp.md`**](https://github.com/shellui/email-service/blob/develop/docs/mcp.md)     |

Shared markers:

- **`x-mcp`:** **`read_only`**, **`destructive`**, **`sensitive`**
- **`x-mcp-secret`** and **`x-mcp-sensitive`** on response schemas
- Revocation poll **`GET …/api/v1/mcp/internal/mcp-revocations`** with **~30 s** consumer cache ([identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md))
- Downstream mint **`POST …/api/v1/mcp/internal/mcp-downstream-access-token`** for ai → service

## Regional approvals (services to identity)

For **storage, hosting, email** writes, services use identity internal routes ([identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)):

- **`POST /api/v1/mcp/internal/mcp-approval-requests`**
- **`POST /api/v1/mcp/internal/mcp-approval-state`**
- **`POST /api/v1/mcp/internal/mcp-approval-consume`** with body **`{"approval_id":"<uuid>"}`** (single use)

**Pipeline (authoritative order):**

1. Create the approval (**mcp-approval-requests**)
2. Poll **mcp-approval-state** until **approved** (or wait for a human **decide** on member routes)
3. Call **mcp-approval-consume** with the **approval_id**. **`consumed: true`** from Identity is authoritative
4. Perform the **write** or **forward** the MCP call **only after** a successful consume. Do not execute and consume later

Humans on **identity**:

- **`GET /api/v1/mcp/approvals?company_id=`**
- **`POST /api/v1/mcp/approvals/{id}/decide`** with **`{"decision":"approve"}`** or **`{"decision":"deny"}`** ([`mcpToolApprovalsApi.ts`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/mcpToolApprovalsApi.ts)). Session allow stays on **`POST /api/v1/mcp/internal/mcp-approval-decide`** for the gateway only

**Global** SaaS approvals are decided on **SaaS** ([First company](#first-company-and-global-approval)). **Regional** identity approvals are decided on **identity** (this section).

**Elicitation:** ai-gateway may return **`_meta.shellui_approval`**. Internal decide uses **`POST /api/v1/mcp/internal/mcp-approval-decide`** with **`allow`**, **`deny`**, or **`allow_session`**. **Non-destructive** session allow lasts **60 s** per **`Mcp-Session-Id`** (clamped **30 to 60 s** in identity). **Destructive** cannot use **`allow_session`**.

## Hosting MCP (exact tool names)

From [hosting **`docs/mcp.md`**](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md). Deploy path:

1. **`hosting_v1_apps_create`** or preview create, or list
2. **`hosting_v1_apps_deployments_create`**
3. **`hosting_v1_apps_deployments_artifact_upload_url_create`**
4. **HTTP PUT** tarball to **`upload_url`** (not inside MCP JSON)
5. **`hosting_v1_apps_deployments_artifact_upload_complete_create`**
6. **`hosting_v1_apps_deployments_finalize_create`**

Domains, env, logs: see the handbook tables. Runtime logs may return **`source: none`** with **`unavailable_reason`** for static sites.

## Storage MCP

From [storage **`docs/mcp.md`**](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md):

- Company bucket slug **`company`**; REST **bucket create** stays **403** on many installs ([Storage API](https://docs.shellui.com/storage/api))
- **Connectors** are configured mounts; tool responses describe **operator readiness**, not unqualified live network proof unless stated
- Use **`tools/list`** on **`POST http://localhost:8002/mcp`** for current operation ids

## Email MCP and local mail

From [email **`docs/mcp.md`**](https://github.com/shellui/email-service/blob/develop/docs/mcp.md). Agents need **`aud = {EMAIL_PUBLIC_URL}/mcp`** and **`scope`** including **`email`**.

**Mailpit** in [`dev/docker-compose.yml`](https://github.com/shellui/shellui/blob/develop/dev/docker-compose.yml): **SMTP** **`1025`**, UI **`8025`**. Identity uses **`EMAIL_HOST=mailpit`**, **`EMAIL_PORT=1025`** in this stack. **Send-test** and live providers follow the email handbook; do not assume internet delivery from a dev box.

## Human CLI

Config: **`saas.url`** or **`SHELLUI_SAAS_URL`**, default **`http://localhost:8005`** when unset. See [CLI](/cli).

**Session:** **`shellui logout`**, **`shellui whoami`**, **`shellui auth status`** (see [CLI](/cli)).

### `shellui companies` (identity, regional decimal)

| Action         | Command                   | HTTP                                 |
| -------------- | ------------------------- | ------------------------------------ |
| List           | `shellui companies list`  | `GET {identity}/api/v1/companies/`   |
| Get one        | `shellui companies get 1` | `GET {identity}/api/v1/companies/1/` |
| Default tenant | `shellui companies use 1` | writes **`cli-session.json`**        |

### `shellui projects` (SaaS, dashboard UUID)

Resolved base is **`saas.url`**; paths are **`/api/v1/...`** (if the base URL includes a path prefix such as **`/saas`**, the CLI joins one full URL; see [`saas-paths.js`](https://github.com/shellui/shellui/blob/develop/packages/cli/src/http/saas-paths.js)).

| Action            | Command                             | HTTP (relative to resolved SaaS base)            |
| ----------------- | ----------------------------------- | ------------------------------------------------ |
| List              | `shellui projects list`             | `GET /api/v1/companies/`                         |
| Get one           | `shellui projects get <uuid>`       | `GET /api/v1/companies/<uuid>/`                  |
| Save default UUID | `shellui projects use <uuid>`       | file only                                        |
| Regions           | `shellui projects regions`          | `GET /api/v1/regions/`                           |
| Endpoints         | `shellui projects endpoints <uuid>` | `GET /api/v1/companies/<uuid>/endpoints/`        |
| Create            | `shellui projects create`           | **not implemented** (exit **`not_implemented`**) |

### `shellui storage buckets`

| Action | Command                        | HTTP                                      |
| ------ | ------------------------------ | ----------------------------------------- |
| List   | `shellui storage buckets list` | `GET {storage}/storage/v1/bucket`         |
| Get    | `shellui storage buckets get`  | `GET {storage}/storage/v1/bucket/company` |

Tenant comes from JWT **`company_id`** only.

### `shellui hosting apps` and `hosting deployments`

| Action            | Command                                     | HTTP                                               |
| ----------------- | ------------------------------------------- | -------------------------------------------------- |
| List apps         | `shellui hosting apps list`                 | `GET {hosting}/hosting/v1/apps`                    |
| Get app           | `shellui hosting apps get <slug>`           | `GET {hosting}/hosting/v1/apps/<slug>`             |
| List deployments  | `shellui hosting deployments list`          | `GET {hosting}/hosting/v1/apps/<slug>/deployments` |
| Deployment status | `shellui hosting deployments status <uuid>` | same list, match **`id`** (no separate GET by id)  |

**`SHELLUI_DEPLOY_TOKEN`** is only for **`shellui deploy`** ([CLI](/cli)).

## SDK (iframe apps, human session)

From [SDK](/sdk): after **`await shellui.init()`**, **`shellui.storage`** uses the **regional human** session the shell forwards:

```typescript
await shellui.init();
const { data, error } = await shellui.storage
  .from('company')
  .upload('docs/reports/2024/q1.pdf', file, { upsert: true });
const { data: entries } = await shellui.storage.from('company').list('docs/reports');
```

MCP agents do not run inside the iframe SDK; they use OAuth and **`tools/call`** on **`/mcp`** URLs with agent JWTs.

## Activity rows (Settings)

**GET** **`/api/v1/mcp/personal/agents/{id}/activity`** returns rows parsed in [`personalAgentsApi.ts`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/personalAgentsApi.ts): **`timestamp`**, **`tool`**, **`service`**, **`result`**, **`client_ip`**, **`company_id`**, **`company_name`**, **`resource_label`**, **`operation_title`**, **`actor`**, **`agent_name`**, **`access_kind`**, **`duration_ms`**, **`outcome`**, **`approval_request_id`**, **`error_code`**, plus **`error_message`** parsed into **`errorDetailRaw`** for diagnostics **outside** the Settings list UI.

**Settings UI** ([`McpAgentActivitySection.tsx`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/settings/components/McpAgentActivitySection.tsx)): shows **`error_code`** only when it matches one of: **`identity_unreachable`**, **`invalid_grant`**, **`permission_changed`**, **`request_expired`**, **`downstream_error`**, **`server_error`**, **`unknown`**. Other codes are dropped. It does **not** show free-form provider text, raw **`error_message`**, URL query fragments, secrets, or raw tool args ([`mcpAgentActivityPresentation.ts`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/mcpAgentActivityPresentation.ts), **`formatActivityResultForDisplay`** for **`result`** tokens). Prefer **`operation_title`**; else a neutral line such as **`Operation {tool}`**.

## `x-mcp` on REST operations

```yaml
x-mcp:
  read_only: true|false
  destructive: true|false
  sensitive: true|false
```

**`read_only`:** maps to safe HTTP methods; **read-only access mode** for an agent **does not** offer **write** or **destructive** tools for consent ([identity MCP and agents, Access levels](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)). **Destructive** tools **always** need a **fresh individual** approval in **every** write-capable access mode. **`mcp_destructive`** and **`allow_destructive_without_asking`** affect **non-destructive** writes only. **`Sensitive`** plus **`mcp_read=safe`** masks personal fields. **`x-mcp-secret`** never reaches agents. Registration stays explicit in code ([storage **`docs/mcp.md`**](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md)).

## Who holds which token

| Actor                      | Token                                   | Typical use                                                        |
| -------------------------- | --------------------------------------- | ------------------------------------------------------------------ |
| Person in browser or shell | Identity **human** JWT                  | **`shellui`** CLI, shell Settings, **`GET /api/v1/mcp/approvals`** |
| MCP agent                  | Identity **agent** JWT per **`aud`**    | **`POST …/mcp`** JSON-RPC                                          |
| ai gateway                 | Delegation JWT and downstream agent JWT | Forward **`tools/call`**                                           |
| CI preview                 | Hosting **deploy** token                | **`shellui deploy`** only                                          |

**`aud`** and **`resource`:** the consent **`resource`** must match the MCP URL you call. **`aud`** on the JWT must match that same resource for the service you invoke.

## Email operators (MCP)

See [email **`docs/mcp.md`**](https://github.com/shellui/email-service/blob/develop/docs/mcp.md) for templates, rules, Actions webhooks, and preview. **Render-preview** does not send mail; **send-test** targets the owner when rules allow.

## OpenAPI discovery

Each service serves **`GET /api/schema/`** and **`GET /api/docs/`**. Resolve **`x-mcp`** and tool ids there. This page does not replace **`tools/list`**.

## Troubleshooting

| Symptom                                | Likely cause                                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Browser blocked SaaS JSON              | **CORS:** add origin to **`SAAS_CORS_ALLOWED_ORIGINS`** (browser-only; not auth)                                       |
| **`403`** on MCP OAuth                 | Staff or missing membership                                                                                            |
| **`403`** on SaaS                      | ToS or global gate, or wrong dashboard company                                                                         |
| **`401`** on **`/c/{id}/mcp`**         | Wrong **`aud`** or **`company_id`** vs URL                                                                             |
| UUID where a decimal is required       | Mixed dashboard id with regional API                                                                                   |
| **`invalid_grant`**                    | Replay, wrong PKCE, expired code                                                                                       |
| Approval stuck                         | Expired id, wrong id, or already consumed                                                                              |
| Revoke delay                           | **~30 s** revocation poll cache plus in-flight calls                                                                   |
| Global exchange fails                  | **`GLOBAL_ISSUER_URL`**, **`GLOBAL_JWKS`**, **`GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`**, and SaaS signing keys misaligned |
| **`identity_unreachable`** in activity | Identity down or blocked from the gateway                                                                              |

## Rebuild locally

```bash
cd shellui/dev
./start.sh
```

Use sibling repos on **`develop`** ([Local dev stack](/dev-stack)). Smoke:

```bash
shellui login
shellui companies get 1
shellui projects list
```

Docs tests in CI do **not** run full OAuth or MCP end to end against live containers.

## Workflow (global create, then regional work)

1. Sign in on the shell and finish **Terms** when your stack gates on them
2. Register a global MCP client, run **POST** **`mcp_authorize`** on **SaaS** with a human **Bearer**, complete **`authorization_code`** at **`POST /oauth/mcp/token`**, then call **`POST https://<saas>/mcp`**
3. **`tools/call`** **`api_v1_companies_create`**; read **`approval_id`** from **`result.meta`** while **`status`** is **`pending`**
4. **POST** **`/api/v1/mcp/approvals/{uuid}/decision`** on **SaaS** with **approve** and **`session_allow: false`**. Retry the **same** **`tools/call`**
5. Read **`regional_company_id`** from the **Company** payload (or list or get). Use **`shellui projects use <uuid>`** and **`shellui projects endpoints <uuid>`** for human inspection
6. Exchange the **global** agent JWT for a **regional** token with **`resource = {AI_URL}/c/<regional_company_id>/mcp`** per [Global agent token exchange](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md), or complete **regional** OAuth on identity with that **`resource`**
7. Call **`POST {AI_URL}/c/<regional_company_id>/mcp`** (or downstream **`…/mcp`**) for tenant work; use **`shellui storage buckets list`** for a REST cross-check with the human session

## Handbook index (`develop`)

| Topic                               | File                                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Identity OAuth, exchange, approvals | [docs/mcp-and-agents.md](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md) |
| AI gateway                          | [docs/mcp.md](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)                             |
| Global SaaS MCP                     | [docs/mcp.md](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md)                           |
| Storage                             | [docs/mcp.md](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md)                        |
| Hosting                             | [docs/mcp.md](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md)                        |
| Email                               | [docs/mcp.md](https://github.com/shellui/email-service/blob/develop/docs/mcp.md)                          |

Published copies may also appear on [docs.shellui.com](https://docs.shellui.com) when the docs build tracks that ref ([Docs site](/docs-site)).

## FAQ

**Why does `shellui companies get 1` differ from `shellui projects get <uuid>`?** The first hits **identity** with a **regional** decimal id. The second hits **SaaS** with a **dashboard** UUID.

**Does read-only access still get destructive tools?** No. **`read_only`** mode does not expose **write** or **destructive** tools. When your mode allows writes, **destructive** tools still need **per-call** approval unless **`allow_destructive_without_asking`** is on for **non-destructive** writes only ([identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)).

**What does `global_mcp_url` mean?** It is a **full** **`…/mcp`** URL for discovery in Settings ([`parseValidatedGlobalMcpEndpointUrl`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/personalAgentsApi.ts)). It does not replace consent or token issuance.

**Does the 12 minute setup cap equal JWT `exp`?** No. **Setup** policy and **JWT** lifetime are different clocks ([First company](#first-company-and-global-approval)).

## Related

- [Authentication](/features/authentication)
- [CLI](/cli)
- [SDK](/sdk)
- [Local dev stack](/dev-stack)
- [Identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)
