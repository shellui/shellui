---
title: AI native platform (global SaaS MCP, regional gateway, human CLI)
sidebar_label: AI native platform
description: Global SaaS MCP, regional gateway, OAuth, approvals, human CLI, SDK, and service handbooks on develop.
---

## Overview

Use this page when you wire **MCP agents** (OAuth + `tools/call`), **human** flows (shell, dashboard, CLI), or **iframe apps** (`@shellui/sdk`). It tracks **`develop`** in **shellui**, **identity-service**, **saas-service**, **ai-service**, and regional services.

**At a glance**

- **Global control plane (SaaS host):** dashboard companies (UUID), regions, endpoints, **`POST …/mcp`**, global tool approvals, OAuth metadata at **`/.well-known/*`** and **`/oauth/mcp/*`**.
- **Regional data plane:** identity (people, JWTs), storage, hosting, email, each with **`POST …/mcp`**; **ai-service** aggregates tools at **`POST …/c/<company_id>/mcp`**.
- **Two company ids:** regional **decimal** (JWT `company_id`, `shellui companies get 1`) vs **dashboard UUID** (`shellui projects get <uuid>`). Do not mix them.
- **Human CLI** uses identity OAuth (`shellui login`). **MCP agents** use separate OAuth clients and tokens. **Iframe SDK** uses the forwarded **regional human** session, not an agent JWT.

Jump: [What you can build](#what-you-can-build) · [Identifiers](#identifiers-and-where-they-appear) · [Global OAuth](#global-saas-mcp-and-oauth) · [First company](#first-company-and-global-approval) · [CLI](#human-cli) · [SDK vs MCP](#sdk-iframe-apps-human-session) · [Activity](#activity-rows-settings) · [FAQ](#faq)

## What you can build

| Goal                                                                  | Surface                                              | Notes                                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| Provision or manage **dashboard** companies, regions, endpoints       | Global SaaS REST or **`POST …/mcp`** tools           | Control-plane only, not object bytes                  |
| **Tenant** storage, hosting, email with approvals                     | Regional **`POST …/mcp`** (direct or via ai gateway) | `company_id` in agent token must match the URL        |
| **Embeds** that upload files or call storage with the signed-in human | **`@shellui/sdk`** after `shellui.init()`            | Same regional session as the shell, not MCP           |
| **Automation** with tool calls                                        | MCP client + OAuth                                   | Refresh and exchange rules differ from human sessions |

## Identifiers and where they appear

| Kind              | Format         | Example                                | Where                                                              |
| ----------------- | -------------- | -------------------------------------- | ------------------------------------------------------------------ |
| Regional tenant   | Decimal string | `1`                                    | JWT `company_id`, `GET /api/v1/companies/`, `POST …/c/1/mcp` on ai |
| Dashboard company | UUID           | `550e8400-e29b-41d4-a716-446655440000` | SaaS JSON, `shellui projects list`                                 |

## Preconditions

1. **Non-staff** human member. Staff cannot complete MCP OAuth ([identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)).
2. **Terms of Service** and other **global** gates your operator configures are satisfied before you create dashboard companies, bind regions, or authorize MCP agents.
3. Do not reuse **deploy tokens** (`SHELLUI_DEPLOY_TOKEN`) or **CLI login** tokens as MCP agent credentials.

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

SaaS browser calls must satisfy `SAAS_CORS_ALLOWED_ORIGINS` ([Local dev stack](/dev-stack#saas-api-cors)). Inter-container bases use `http://<name>:8000`.

## Mental model

**Global plane (SaaS host):** dashboard companies (UUID), regions, endpoints, **global MCP** `POST /mcp`, OAuth at `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, `/oauth/mcp/register`, `/oauth/mcp/authorize`, `/oauth/mcp/token`. Global tools operate on **control-plane** data, not object bytes.

**Regional plane:** identity (people, JWTs, member APIs), storage, hosting, and email each expose `POST /mcp` with a service-scoped agent `aud`. **ai-service** exposes **`POST /c/<company_id>/mcp`** and aggregates downstream tools as `service_toolname` (single underscore). Plain **`POST http://localhost:8006/mcp`** returns **`404`** `company_required` ([ai MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)).

**Human CLI:** `shellui login` stores an OAuth session for **identity**. Commands call identity or SaaS with that Bearer. They do not speak MCP JSON-RPC.

## Global SaaS MCP and OAuth

**Not the same URL:** `https://<saas>/oauth/mcp/authorize` is the **OAuth** authorization endpoint. The Streamable MCP JSON-RPC surface is **`POST https://<saas>/mcp`**.

Discovery and client registration:

- `GET https://<saas>/.well-known/oauth-protected-resource`
- `GET https://<saas>/.well-known/oauth-authorization-server`
- `POST https://<saas>/oauth/mcp/register`
- `GET https://<saas>/oauth/mcp/authorize` with PKCE (S256) and RFC 8707 `resource`
- `POST https://<saas>/oauth/mcp/token` for `authorization_code`

**Interactive OAuth:** use the **browser redirect** (`GET /oauth/mcp/authorize` → identity sign-in and consent → `POST /oauth/mcp/token` with the code). **SaaS documents** requiring **`Authorization: Bearer <identity human access token>`** on **`GET /oauth/mcp/authorize`** for some flows; see **saas-service** [`docs/mcp.md` on `develop`](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md) and URL wiring in **`config/urls.py`** and **`apps/agents/urls.py`**. Do not document invented `POST` authorize routes unless OpenAPI lists them.

**Global agent access token** (RS256 from the global issuer) is separate from the regional human session. **Do not** add a refresh story for global agents here beyond what OpenAPI lists. **Regional** agent tokens refresh at `POST /oauth/mcp/token` with `grant_type=refresh_token` and the **same** `resource` as consent ([identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)).

### Global to regional agent exchange (RFC 8693)

From [identity MCP and agents, Global agent token exchange](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md) (`develop`):

```http
POST /oauth/mcp/token
Content-Type: application/json
```

```json
{
  "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
  "subject_token": "<global agent JWT>",
  "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "company_id": "<regional company id>",
  "resource": "https://<regional-host>/mcp",
  "access_mode": "read_only",
  "read_level": "safe",
  "allow_destructive": false,
  "services": ["identity", "storage"]
}
```

Identity verifies the subject token offline (`iss`, `aud`, `exp`, **`jti`** replay cache), may **reuse** one regional `Agent` row per `(company_id, global_agent_id)`, and issues normal MCP access and refresh tokens for the requested `resource`. Optional fields may **narrow** the global agent only (never broaden). A **wider** subject token cannot be applied after a narrowed exchange; follow identity errors for **revoked** global agents and refresh handling.

**`company_id`** is the **regional decimal** tenant. It must match **membership and binding** for that user; do not paste a number from a client unless it matches the server-bound **`setup_context_company_id`** from your provisioning flow (see below).

## First company and global approval

**Tool name:** `api_v1_companies_create` (confirm with `tools/list` on **`POST http://localhost:8005/mcp`**).

1. Agent calls `tools/call` for `api_v1_companies_create` with arguments from OpenAPI (for example name and region code).
2. While pending, the tool result matches **saas-service** [`docs/mcp.md` on `develop`](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md): for example **`status`** **`pending`** and **`approval_id`** (UUID) on the **global** store (**SaaS**, not regional identity).
3. A **human** approves on the SaaS host with an **identity-issued** human Bearer (same account that passed ToS):

```http
POST /api/v1/mcp/approvals/<uuid>/decision
Authorization: Bearer <identity human access token>
Content-Type: application/json
```

```json
{
  "decision": "approve",
  "session_allow": false
}
```

4. The agent **retries the same** `tools/call` with **identical** arguments. SaaS **consumes** the approval once, runs **create**, and **binds** **`setup_context_company_id`**. That **numeric regional id** comes from the **server** (active setup grant and prior binding), not from a client-supplied tenant claim.

5. **Setup timing:** non-destructive **new-company setup** uses an **absolute 12 minute** ceiling on the **setup grant** your operator issues. While **more than 600 seconds** remain on that grant, non-destructive **session-style allow** may extend into a **600 to 900 second** window as the server configures. When **600 seconds or less** remain, only the **ordinary 60 second** non-destructive session rule applies. **Destructive** tools always require an **individual** fresh approval in **every** access mode (see [x-mcp](#x-mcp-on-rest-operations)).

**Not the same clock:** the **12 minute** setup grant is an **approval and provisioning policy** window. The **`exp` on a global agent JWT** is the token lifetime from the issuer. Compare claims only inside the product that minted them.

## Identity personal status (`global_mcp_url` and grant fields)

**Shipped in this repo today:** identity may return **`global_mcp_url`**. The shell parses it as a **full MCP endpoint** URL, **https** or **http**, path exactly **`/mcp`** ([`parseValidatedGlobalMcpEndpointUrl`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/personalAgentsApi.ts)). It is **not** a boolean “allowed tools” flag. It tells the UI which **resource URL** to show for global MCP (Settings), not whether a human may run a tool.

**Contract landing with identity [#135](https://github.com/shellui/identity-service/pull/135) (verify on `develop` before merge):** responses are expected to add at least:

- `grant_version`
- `company_binding_version`
- `setup_expires_at`

Treat these as **service versioning and provenance** for grants and binding. They are **not** a substitute for reading SaaS or tool results. When [#135](https://github.com/shellui/identity-service/pull/135) merges, align dashboards and docs with the published OpenAPI on identity **`develop`**.

## Regional MCP (ai gateway)

**Metadata:**

```http
GET http://localhost:8006/.well-known/oauth-protected-resource/c/2/mcp
```

**Streamable HTTP:**

```http
POST http://localhost:8006/c/2/mcp
```

Token **`aud`** must equal that resource URL and **`company_id`** must match **`2`**.

Optional query for SaaS at consent: metadata may include `shellui_mcp_authorize_query: {"saas_offered":"1"}` so clients add `saas_offered=1` on `GET /oauth/mcp/authorize` ([ai MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)).

## Regional service MCP

| Service | Handbook                                                                                     |
| ------- | -------------------------------------------------------------------------------------------- |
| Storage | [storage `docs/mcp.md`](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md) |
| Hosting | [hosting `docs/mcp.md`](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md) |
| Email   | [email `docs/mcp.md`](https://github.com/shellui/email-service/blob/develop/docs/mcp.md)     |

Shared markers:

- `x-mcp`: `read_only`, `destructive`, `sensitive`
- `x-mcp-secret` and `x-mcp-sensitive` on response schemas
- Revocation poll `GET …/api/v1/mcp/internal/mcp-revocations` with **~30 s** consumer cache ([identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md))
- Downstream mint `POST …/api/v1/mcp/internal/mcp-downstream-access-token` for ai → service

## Regional approvals (services to identity)

For **storage, hosting, email** writes, services use identity internal routes ([identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)):

- `POST /api/v1/mcp/internal/mcp-approval-requests`
- `POST /api/v1/mcp/internal/mcp-approval-state`
- `POST /api/v1/mcp/internal/mcp-approval-consume` with body `{"approval_id":"<uuid>"}` (single use)

Humans use **identity** member routes for **regional** service approvals:

- `GET /api/v1/mcp/approvals?company_id=`
- `POST /api/v1/mcp/approvals/{id}/decide` with JSON `{"decision":"approve"}` or `{"decision":"deny"}` ([`mcpToolApprovalsApi.ts`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/mcpToolApprovalsApi.ts)). Identity **`McpApprovalDecideView`** accepts `approve`, `allow`, `deny`, or `reject`; it does **not** take **`session_allow`** on this path ([`apps/agents/admin_views.py`](https://github.com/shellui/identity-service/blob/develop/apps/agents/admin_views.py)). Session allow stays on **`POST /api/v1/mcp/internal/mcp-approval-decide`** inside the gateway only.

**Global** tool approvals on **SaaS** are decided on **SaaS** ([First company](#first-company-and-global-approval)). **Regional** tool approvals on **identity** are decided on **identity** (this section).

**Elicitation:** ai-gateway may return `_meta.shellui_approval`. Internal decide uses `POST /api/v1/mcp/internal/mcp-approval-decide` with `allow`, `deny`, or `allow_session`. Non-destructive **session allow** lasts **60 seconds** per `Mcp-Session-Id` (clamped **30 to 60** in identity). Destructive cannot use `allow_session`.

## Hosting MCP (exact tool names)

From [hosting `docs/mcp.md`](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md). Deploy path:

1. `hosting_v1_apps_create` or preview create, or list
2. `hosting_v1_apps_deployments_create`
3. `hosting_v1_apps_deployments_artifact_upload_url_create`
4. **HTTP PUT** tarball to `upload_url` (not through MCP JSON body)
5. `hosting_v1_apps_deployments_artifact_upload_complete_create`
6. `hosting_v1_apps_deployments_finalize_create`

Domains, env, logs: handbook tables list MCP-exposed operations. Runtime logs may return `source: none` with `unavailable_reason` for static sites.

## Storage MCP

From [storage `docs/mcp.md`](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md):

- Company bucket slug **`company`**; **bucket create** through REST remains **403** on typical installs ([Storage API](https://docs.shellui.com/storage/api)).
- **Connectors** are configured mounts; tools expose configuration **check** paths. Responses describe **decrypted readiness for operators**, not live external network proof unless the tool states it.
- Use `tools/list` on **`POST http://localhost:8002/mcp`** for current operation ids.

## Email MCP and local mail

From [email `docs/mcp.md`](https://github.com/shellui/email-service/blob/develop/docs/mcp.md). Agents need `aud = {EMAIL_PUBLIC_URL}/mcp` and `scope` including **`email`**.

**Local compose:** **Mailpit** listens on **`1025` (SMTP)** and **`8025` (UI)** ([`dev/docker-compose.yml`](https://github.com/shellui/shellui/blob/develop/dev/docker-compose.yml)). Identity is wired to **`EMAIL_HOST=mailpit`** and **`EMAIL_PORT=1025`** in that stack so password resets and sign-in mail stay local. Do not assume internet delivery from a dev machine. For **send-test** and provider-backed routes, follow the email service handbook; omit invented provider names in examples.

## Human CLI

Config: `saas.url` or `SHELLUI_SAAS_URL`, default **`http://localhost:8005`** when unset. See [CLI](/cli).

**Session:** `shellui logout` clears stored credentials and best-effort `POST /api/v1/logout`. `shellui whoami` calls `GET /api/v1/user`. `shellui auth status` summarizes credentials and tenant ids without printing tokens.

### `shellui companies` (identity, regional decimal)

| Action         | Command                   | HTTP                                 |
| -------------- | ------------------------- | ------------------------------------ |
| List           | `shellui companies list`  | `GET {identity}/api/v1/companies/`   |
| Get one        | `shellui companies get 1` | `GET {identity}/api/v1/companies/1/` |
| Default tenant | `shellui companies use 1` | writes `cli-session.json`            |

### `shellui projects` (SaaS, dashboard UUID)

Paths are under **`/api/v1/`** on the SaaS host. When `saas.url` includes a path prefix (for example `https://host/saas`), the CLI joins **`…/saas/api/v1/...`** as a single base ([`saas-paths.js`](https://github.com/shellui/shellui/blob/develop/packages/cli/src/http/saas-paths.js)).

| Action            | Command                             | HTTP (relative to resolved SaaS base)        |
| ----------------- | ----------------------------------- | -------------------------------------------- |
| List              | `shellui projects list`             | `GET /api/v1/companies/`                     |
| Get one           | `shellui projects get <uuid>`       | `GET /api/v1/companies/<uuid>/`              |
| Save default UUID | `shellui projects use <uuid>`       | file only                                    |
| Regions           | `shellui projects regions`          | `GET /api/v1/regions/`                       |
| Endpoints         | `shellui projects endpoints <uuid>` | `GET /api/v1/companies/<uuid>/endpoints/`    |
| Create            | `shellui projects create`           | **not implemented** (exit `not_implemented`) |

There is **no** CLI command to create a **regional** company from the shell; use the dashboard or approved automation.

### `shellui storage buckets`

| Action | Command                        | HTTP                                      |
| ------ | ------------------------------ | ----------------------------------------- |
| List   | `shellui storage buckets list` | `GET {storage}/storage/v1/bucket`         |
| Get    | `shellui storage buckets get`  | `GET {storage}/storage/v1/bucket/company` |

Tenant comes from JWT **`company_id`** only (CLI does not append `company_id` query params for these calls).

### `shellui hosting apps` and `hosting deployments`

| Action            | Command                                     | HTTP                                                         |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------ |
| List apps         | `shellui hosting apps list`                 | `GET {hosting}/hosting/v1/apps`                              |
| Get app           | `shellui hosting apps get <slug>`           | `GET {hosting}/hosting/v1/apps/<slug>`                       |
| List deployments  | `shellui hosting deployments list`          | `GET {hosting}/hosting/v1/apps/<slug>/deployments`           |
| Deployment status | `shellui hosting deployments status <uuid>` | same list, then match **`id`** (no separate GET by id today) |

`SHELLUI_DEPLOY_TOKEN` is **only** for **`shellui deploy`** ([CLI](/cli)).

## SDK (iframe apps, human session)

From [SDK](/sdk): after `await shellui.init()`, `shellui.storage` uses the **regional human** session the shell forwards (not an MCP agent token):

```typescript
await shellui.init();
const { data, error } = await shellui.storage
  .from('company')
  .upload('docs/reports/2024/q1.pdf', file, { upsert: true });
const { data: entries } = await shellui.storage.from('company').list('docs/reports');
```

MCP agents do not run inside the iframe SDK; they use OAuth and **`tools/call`** on service `/mcp` URLs with agent JWTs.

## Activity rows (Settings)

Identity `GET /api/v1/mcp/personal/agents/{id}/activity` returns rows parsed in [`personalAgentsApi.ts`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/personalAgentsApi.ts): `timestamp`, `tool`, `service`, `result`, `client_ip`, `company_id`, `company_name`, `resource_label`, `operation_title`, `actor`, `agent_name`, `access_kind`, `duration_ms`, `outcome`, `approval_request_id`, `error_code`, plus optional `error_message` for tests only.

**Settings display (merged [#182](https://github.com/shellui/shellui/pull/182)):**

- **`result`:** only **recognized** result tokens map to outcomes; arbitrary strings do not surface as raw text ([`formatActivityResultForDisplay`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/mcpAgentActivityPresentation.ts)).
- **`error_code`:** allowlist only (`identity_unreachable`, `invalid_grant`, `permission_changed`, `request_expired`, `downstream_error`, `server_error`, `unknown`). The UI maps these to labels; unknown codes are dropped.
- **`error_message`:** parsed for contract tests; **Settings never displays** the raw body.
- **Summary line:** prefers **`operation_title`**; else **`Operation {tool}`** via [`buildActivityPrimarySummary`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/mcpAgentActivityPresentation.ts) (neutral **Operation** prefix).

Do **not** print agent JWTs, refresh tokens, or raw tool arguments in docs or UIs.

## `x-mcp` on REST operations

Every opted-in operation publishes:

```yaml
x-mcp:
  read_only: true|false
  destructive: true|false
  sensitive: true|false
```

**Read only** tools map to safe HTTP methods. **Destructive** tools **always** require an **individual** human approval in **every** access mode. **`mcp_destructive`** and **`allow_destructive_without_asking`** only change whether **non-destructive** writes can run without a prompt; they **do not** grant a free pass for destructive work ([identity MCP and agents, Access levels](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)). **Sensitive** plus **`mcp_read=safe`** masks personal fields. **`x-mcp-secret`** response properties never reach agents. Registration is explicit in code, not tag-only ([storage `docs/mcp.md`](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md)).

## Internal approval pipeline (service to identity)

1. Service posts **`mcp-approval-requests`** with a signed assertion and redacted arguments.
2. Gateway or human surfaces pending state.
3. Human or elicitation supplies **`allow`**, **`deny`**, or **`allow_session`** on the internal decide path when applicable.
4. Service polls **`mcp-approval-state`** until `approved`.
5. Service executes the write and posts **`mcp-approval-consume`** with `approval_id` (atomic, single use, within the **10 minute** window in the handbook).
6. On deny or expiry the tool stays **failed**; there is no silent success.

## Who holds which token

| Actor                      | Token                                 | Typical use                                                |
| -------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| Person in browser or shell | Identity **human** JWT                | `shellui` CLI, shell Settings, `GET /api/v1/mcp/approvals` |
| MCP agent                  | Identity **agent** JWT per `aud`      | `POST …/mcp` JSON-RPC                                      |
| ai gateway                 | Delegation JWT + downstream agent JWT | Forward `tools/call`                                       |
| CI preview                 | Hosting **deploy** token              | `shellui deploy` only                                      |

**`aud` and `resource`:** the consent and token exchange **`resource`** must match the MCP resource URL the client calls. The JWT **`aud`** must match that same URL for the service you invoke.

## Email operators (MCP)

See [email `docs/mcp.md`](https://github.com/shellui/email-service/blob/develop/docs/mcp.md) for template CRUD, rules, Actions webhooks, and preview render. **Render-preview** does not send mail; **send-test** targets the owner address when rules allow. Dev mail lands in Mailpit.

## OpenAPI discovery

Each service serves **`GET /api/schema/`** and **`GET /api/docs/`**. Use them to resolve **`x-mcp`** flags and tool ids. No hand-maintained tool list in this repo replaces **`tools/list`**.

## Troubleshooting

| Symptom                          | Likely cause                                                     |
| -------------------------------- | ---------------------------------------------------------------- |
| Browser blocked SaaS JSON        | CORS: add your origin to `SAAS_CORS_ALLOWED_ORIGINS`             |
| `403` on MCP OAuth               | Staff account or missing membership                              |
| `403` on SaaS                    | ToS or global gate, or wrong dashboard company                   |
| `401` on ai `/c/{id}/mcp`        | Wrong `aud` or `company_id` in token vs URL                      |
| UUID where a decimal is required | Mixed dashboard id with regional API                             |
| `invalid_grant` on token         | Replay, wrong PKCE, expired code                                 |
| Approval stuck                   | Expired row, wrong approval id, or already consumed              |
| Revoke delay                     | Up to **~30 s** cache on revocation poll plus in-flight requests |

## Rebuild locally

```bash
cd shellui/dev
./start.sh
```

Pull **`develop`** on sibling services first ([Local dev stack](/dev-stack)). Smoke:

```bash
shellui login
shellui companies get 1
shellui projects list
```

## Workflow (global create, then regional work)

1. Sign in on the shell and finish **Terms** in the global dashboard when your stack gates on them.
2. Connect a **global** MCP client to **`POST https://<saas>/mcp`**, complete OAuth (`/oauth/mcp/register`, `/oauth/mcp/authorize`, `/oauth/mcp/token`).
3. Run `tools/call` for **`api_v1_companies_create`**; record **`approval_id`** from the pending result.
4. Approve on **SaaS** ([First company](#first-company-and-global-approval)). Retry the **same** `tools/call`; the row must **consume** once.
5. Read **`setup_context_company_id`** and the **dashboard company UUID** from the SaaS response your OpenAPI documents.
6. `shellui login` then `shellui projects use <uuid>` and `shellui projects endpoints <uuid>` with the **human** CLI session.
7. Connect a **regional** MCP client to **`POST https://<ai>/c/<setup_context_company_id>/mcp`** and finish OAuth with `resource` set to that URL.
8. Use `tools/call` on storage or hosting for tenant work; use **`shellui storage buckets list`** for a REST cross-check with the same human session.

## Handbook index (`develop`)

| Topic                                            | File                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Identity OAuth, exchange, approvals, revocation  | [docs/mcp-and-agents.md](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md) |
| AI gateway                                       | [docs/mcp.md](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)                             |
| Global SaaS MCP (approve route, pending payload) | [docs/mcp.md](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md)                           |
| Storage tools                                    | [docs/mcp.md](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md)                        |
| Hosting tools                                    | [docs/mcp.md](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md)                        |
| Email tools                                      | [docs/mcp.md](https://github.com/shellui/email-service/blob/develop/docs/mcp.md)                          |

Published copies also render under [docs.shellui.com](https://docs.shellui.com) when your docs build tracks `main` or the configured ref ([Docs site](/docs-site)).

## FAQ

**Why does `shellui companies get 1` differ from `shellui projects get <uuid>`?** The first calls **identity** with a **regional** decimal id. The second calls **SaaS** with a **dashboard** UUID. They are different products.

**Can read-only agents skip approvals?** Read-only mode skips **write** approvals. **Destructive** tools still need explicit approval each time.

**Where is the global MCP URL in Settings?** From identity **`global_mcp_url`**, validated as **`https?://host/mcp`** ([`parseValidatedGlobalMcpEndpointUrl`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/personalAgentsApi.ts)).

**Does the setup grant equal JWT `exp`?** No. The **12 minute** cap is policy on the **setup grant**. JWT **`exp`** is issuer TTL. Use the right clock for each ([First company](#first-company-and-global-approval)).

## Related

- [Authentication](/features/authentication)
- [CLI](/cli)
- [SDK](/sdk)
- [Local dev stack](/dev-stack)
- [Identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)
