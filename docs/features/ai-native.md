---
title: AI native platform (global SaaS MCP, regional gateway, human CLI)
sidebar_label: AI native platform
description: Global and regional MCP, OAuth, approvals, delegation, CLI, storage, hosting, and local compose. Sources are service handbooks on develop and this repository.
---

## 1. What this is

Shellui runs a **regional** identity (people and memberships), a **global** SaaS API (dashboard companies as UUIDs, regions, endpoints), and an **ai-service** MCP **gateway** per regional `company_id`. Services expose `POST …/mcp` with OpenAPI `x-mcp` markers. Identity is the OAuth authorization server for MCP. This page matches **`develop`** branches and the code in **`shellui/shellui`**.

## 2. Preconditions

1. You use a **non-staff** human member account. Staff cannot complete MCP OAuth ([identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)).
2. **Terms of Service** and any other **global** gates your operator configures are satisfied **before** you create dashboard companies, bind regions, or authorize MCP agents.
3. You do not reuse **deploy tokens** (`SHELLUI_DEPLOY_TOKEN`) or **CLI login** tokens as MCP agent credentials.

## 3. Two company identifiers

| Kind              | Format         | Example                                | Where it appears                                                   |
| ----------------- | -------------- | -------------------------------------- | ------------------------------------------------------------------ |
| Regional tenant   | Decimal string | `1`                                    | JWT `company_id`, `GET /api/v1/companies/`, `POST …/c/1/mcp` on ai |
| Dashboard company | UUID           | `550e8400-e29b-41d4-a716-446655440000` | SaaS JSON, `shellui projects list`                                 |

Do not pass a regional id to a SaaS path that expects a UUID, or the reverse.

## 4. Local URLs (from this repo)

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

## 5. Mental model

**Global plane (SaaS host):** dashboard companies (UUID), regions catalog, company endpoints, **global MCP** `POST /mcp`, OAuth at `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, `/oauth/mcp/register`, `/oauth/mcp/authorize`, `/oauth/mcp/token`. Global tools operate on **control-plane** data, not object bytes in storage.

**Regional plane:** identity (people, JWTs, member APIs), storage, hosting, email each with `POST /mcp` and service-scoped agent `aud`. **ai-service** exposes **`POST /c/<company_id>/mcp`** and aggregates downstream tools as `service_toolname` (single underscore). Plain `POST http://localhost:8006/mcp` returns **`404`** `company_required` ([ai MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)).

**Human CLI:** `shellui login` stores an OAuth session for **identity**. Commands call identity or SaaS with that Bearer. They do not speak MCP JSON-RPC.

## 6. Global SaaS MCP and OAuth

**Not the same URL:** `https://<saas>/oauth/mcp/authorize` is for the **OAuth** browser (or AS metadata). The Streamable MCP JSON-RPC endpoint is **`POST https://<saas>/mcp`**.

Discovery and client registration (pattern on develop):

- `GET https://<saas>/.well-known/oauth-protected-resource`
- `GET https://<saas>/.well-known/oauth-authorization-server`
- `POST https://<saas>/oauth/mcp/register`
- `GET https://<saas>/oauth/mcp/authorize` with PKCE (S256) and RFC 8707 `resource`
- `POST https://<saas>/oauth/mcp/token` for `authorization_code`

**Authorize with a pre-authenticated human:** some deployments expect **`Authorization: Bearer <identity human access token>`** on **`GET /oauth/mcp/authorize`** so the AS knows which account to bind before consent. That is not a `POST` unless your OpenAPI documents one. Prefer the normal browser redirect for interactive clients.

**Global agent access token** (RS256 from the global issuer) is a **separate** product from the regional human session. **Do not** document a second refresh path for global agents here. **Regional** agent tokens refresh at `POST /oauth/mcp/token` with `grant_type=refresh_token` and the **same** `resource` as consent ([identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)). Narrowing-only RFC 8693 exchange from **global agent** to **regional agent** is in that same file under **Global agent token exchange**.

## 7. First company create (global MCP tool)

**Tool name** (OpenAPI on your SaaS build): `api_v1_companies_create` (verify with `tools/list` on **`POST http://localhost:8005/mcp`**).

Expected flow:

1. Agent calls `tools/call` for `api_v1_companies_create` with arguments your schema defines (for example `name`, `region` code).
2. Response is **`pending`** and includes **`approval_id`** (UUID) for the **global** approval row stored on **SaaS**, not on regional identity.
3. A **human** approves on the **SaaS** host with an **identity-issued** human Bearer (same account that passed ToS). Paths follow **SaaS OpenAPI** on your build (for example **`POST /api/v1/mcp/approvals/<uuid>/decision`** with `{"decision":"approve","session_allow":false}` when the schema lists those fields).

4. The agent **retries the same** `tools/call` with identical arguments. SaaS **consumes** the approval once, runs **create**, and **binds** the new dashboard company to **`setup_context_company_id`** (numeric regional id chosen when the setup grant is active). **`setup_context_company_id`** is server-bound; the client does not invent another tenant.

5. **Setup grant timing:** non-destructive **new-company setup** uses an **absolute 12 minute** ceiling. While **more than 600 seconds** remain on that setup grant, **session-style allow** for non-destructive follow-up may extend into a **600-900 second** window as configured by the server. When **600 seconds or less** remain, only the **ordinary 60 second** non-destructive session rule applies. **Destructive** tools always need an **individual** fresh approval in **every** access mode.

## 8. Global status in Settings

Identity and SaaS may expose:

- `grant_version`
- `company_binding_version`
- `setup_expires_at`
- `global_mcp_url`

Treat these as **authoritative** for whether a human session is allowed to run global tools. **`global_mcp_url`** is a **full URL** for the global MCP resource the shell shows (for example the public SaaS or dashboard origin **without** appending a second `/mcp` if the field is already the resource URL). **`parseMcpPersonalStatus` in this repo** ([`personalAgentsApi.ts`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/personalAgentsApi.ts)) still reads only `mcp_enabled`, `mcp_url`, `global_identity`; extend the client when your identity response includes the new keys.

## 9. Regional MCP (ai gateway)

**Metadata:**

```http
GET http://localhost:8006/.well-known/oauth-protected-resource/c/2/mcp
```

**Streamable HTTP:**

```http
POST http://localhost:8006/c/2/mcp
```

Token `aud` must equal that resource URL and `company_id` must match **`2`**.

Optional query for SaaS at consent: metadata may include `shellui_mcp_authorize_query: {"saas_offered":"1"}` so clients add `saas_offered=1` on `GET /oauth/mcp/authorize` ([ai MCP gateway](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)).

## 10. Regional service MCP

| Service | Handbook                                                                                     |
| ------- | -------------------------------------------------------------------------------------------- |
| Storage | [storage `docs/mcp.md`](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md) |
| Hosting | [hosting `docs/mcp.md`](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md) |
| Email   | [email `docs/mcp.md`](https://github.com/shellui/email-service/blob/develop/docs/mcp.md)     |

Common rules:

- `x-mcp: read_only`, `destructive`, `sensitive`
- `x-mcp-secret` and `x-mcp-sensitive` on response schemas
- Revocation poll `GET …/api/v1/mcp/internal/mcp-revocations` with **~30 s** consumer cache ([identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md))
- Downstream mint `POST …/mcp/internal/mcp-downstream-access-token` for ai → service

## 11. Regional approvals (services → identity)

For **storage, hosting, email** writes, services use identity internal routes ([identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)):

- `POST /api/v1/mcp/internal/mcp-approval-requests`
- `POST /api/v1/mcp/internal/mcp-approval-state`
- `POST /api/v1/mcp/internal/mcp-approval-consume` with body `{"approval_id":"<uuid>"}` (single use)

Humans use **identity** member routes for **regional** service approvals (storage, hosting, email tools that created rows in identity):

- `GET /api/v1/mcp/approvals?company_id=`
- `POST /api/v1/mcp/approvals/{id}/decide` with JSON **`{"decision":"approve"}`** or **`{"decision":"deny"}`** ([`mcpToolApprovalsApi.ts`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/mcpToolApprovalsApi.ts)). Identity **`McpApprovalDecideView`** accepts `approve`, `allow`, `deny`, or `reject`; it does **not** take **`session_allow`** on this path ([`apps/agents/admin_views.py`](https://github.com/shellui/identity-service/blob/develop/apps/agents/admin_views.py)). Session allow stays on **`POST /api/v1/mcp/internal/mcp-approval-decide`** inside the gateway only.

**Global** tool approvals that SaaS stores are **decided on SaaS** (section 7). **Regional** tool approvals that identity stores are **decided on identity** (this section).

**Elicitation in chat:** ai-gateway may return `_meta.shellui_approval`; internal decide uses `POST /api/v1/mcp/internal/mcp-approval-decide` with `allow`, `deny`, or `allow_session`. Non-destructive **session allow** lasts **60 seconds** per `Mcp-Session-Id` (clamped **30-60** in identity). Destructive cannot use `allow_session`.

## 12. Hosting MCP (exact tool names)

From [hosting `docs/mcp.md`](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md). Deploy path:

1. `hosting_v1_apps_create` or preview create, or list
2. `hosting_v1_apps_deployments_create`
3. `hosting_v1_apps_deployments_artifact_upload_url_create`
4. **HTTP PUT** tarball to `upload_url` (not through MCP JSON body)
5. `hosting_v1_apps_deployments_artifact_upload_complete_create`
6. `hosting_v1_apps_deployments_finalize_create`

Domains, env, logs: handbook tables list MCP-exposed operations. Runtime logs may return `source: none` with `unavailable_reason` for static sites.

## 13. Storage MCP

From [storage `docs/mcp.md`](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md):

- Company bucket slug **`company`**; **bucket create** through REST remains **403** on typical installs ([Storage API](https://docs.shellui.com/storage/api)).
- **Connectors** are configured mounts; tools expose configuration **check** paths. Responses describe **decrypted readiness for operators**, not live external network proof unless the tool states it.
- Use `tools/list` on **`POST http://localhost:8002/mcp`** for current operation ids.

## 14. Email MCP and local mail

From [email `docs/mcp.md`](https://github.com/shellui/email-service/blob/develop/docs/mcp.md). Agents need `aud = {EMAIL_PUBLIC_URL}/mcp` and `scope` including **`email`**. **Send** paths require provider configuration; local compose uses **Mailpit** at **`http://localhost:8025`** ([Local dev stack](/dev-stack)); do not assume internet delivery from a dev box.

## 15. Human CLI (merged behavior)

Config: `saas.url` or `SHELLUI_SAAS_URL`, default **`http://localhost:8005`** when unset. See [CLI](/cli).

### `shellui companies`

Uses **identity** only.

| Action         | Command                   | HTTP                                 |
| -------------- | ------------------------- | ------------------------------------ |
| List           | `shellui companies list`  | `GET {identity}/api/v1/companies/`   |
| Get one        | `shellui companies get 1` | `GET {identity}/api/v1/companies/1/` |
| Default tenant | `shellui companies use 1` | writes `cli-session.json`            |

### `shellui projects`

Uses **SaaS** with the same login session.

| Action            | Command                             | HTTP                                            |
| ----------------- | ----------------------------------- | ----------------------------------------------- |
| List              | `shellui projects list`             | `GET {saas}/saas/api/v1/companies/`             |
| Get one           | `shellui projects get <uuid>`       | `GET {saas}/saas/api/v1/companies/<uuid>/`      |
| Save default UUID | `shellui projects use <uuid>`       | file only                                       |
| Regions           | `shellui projects regions`          | `GET {saas}/api/v1/regions/`                    |
| Endpoints         | `shellui projects endpoints <uuid>` | `GET {saas}/api/v1/companies/<uuid>/endpoints/` |
| Create            | `shellui projects create`           | **not implemented** (exit `not_implemented`)    |

**Note:** many REST examples use **`/api/v1/companies`** without the `saas` prefix. The CLI **today** uses **`/saas/api/v1/companies/`** for list and get. A later CLI revision may align with bare `/api/v1`; watch release notes.

### `shellui storage buckets`

| Action | Command                        | HTTP                                      |
| ------ | ------------------------------ | ----------------------------------------- |
| List   | `shellui storage buckets list` | `GET {storage}/storage/v1/bucket`         |
| Get    | `shellui storage buckets get`  | `GET {storage}/storage/v1/bucket/company` |

Tenant comes from JWT `company_id` only.

### `shellui hosting apps`

| Action | Command                           | HTTP                                   |
| ------ | --------------------------------- | -------------------------------------- |
| List   | `shellui hosting apps list`       | `GET {hosting}/hosting/v1/apps`        |
| Get    | `shellui hosting apps get <slug>` | `GET {hosting}/hosting/v1/apps/<slug>` |

`SHELLUI_DEPLOY_TOKEN` is **only** for **`shellui deploy`** ([CLI](/cli)).

## 16. SDK (iframe apps, human session)

From [SDK](/sdk): after `await shellui.init()`, `shellui.storage` uses the **regional human** session the shell forwards (not an MCP agent token):

```typescript
await shellui.init();
const { data, error } = await shellui.storage
  .from('company')
  .upload('docs/reports/2024/q1.pdf', file, { upsert: true });
const { data: entries } = await shellui.storage.from('company').list('docs/reports');
```

MCP agents never run inside the iframe SDK; they use **OAuth** and **`tools/call`** on service `/mcp` URLs.

## 17. Activity rows (Settings)

Identity `GET /api/v1/mcp/personal/agents/{id}/activity` returns rows parsed in [`personalAgentsApi.ts`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/personalAgentsApi.ts): `timestamp`, `tool`, `service`, `result`, `client_ip`, `company_id`, `company_name`, `resource_label`, `operation_title`, `actor`, `agent_name`, `access_kind`, `duration_ms`, `outcome`, `approval_request_id`, `error_message`.

Display pipeline: [`mcpAgentActivityPresentation.ts`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/mcpAgentActivityPresentation.ts) maps **exact** `outcome` and `access_kind` tokens, sanitizes `result` and `error_message` (URL queries stripped, secret-like substrings redact whole string, length cap). It does **not** dump raw tool arguments or arbitrary JSON.

## 18. OpenAPI discovery

Each service serves **`GET /api/schema/`** and **`GET /api/docs/`**. Use them to resolve **`x-mcp`** flags and tool ids. No hand-maintained tool list in this repo replaces **`tools/list`**.

## 19. Troubleshooting

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

## 20. Rebuild locally

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

## 21. Workflow (global create, then regional work)

1. Sign in on the shell and finish **Terms** in the global dashboard when your stack gates on them.
2. Connect a **global** MCP client to **`POST https://<saas>/mcp`**, complete OAuth (`/oauth/mcp/register`, `/oauth/mcp/authorize`, `/oauth/mcp/token`).
3. Run `tools/call` for **`api_v1_companies_create`**; keep **`approval_id`** from the pending result.
4. Approve on **SaaS** (section 7). Retry the **same** `tools/call`; the row must **consume** once.
5. Read **`setup_context_company_id`** and the **dashboard company UUID** from the SaaS response body your OpenAPI documents.
6. `shellui login` then `shellui projects use <uuid>` and `shellui projects endpoints <uuid>` to read regional endpoints with the **human** CLI session.
7. Connect a **regional** MCP client to **`POST https://<ai>/c/<setup_context_company_id>/mcp`** and finish OAuth with `resource` set to that URL.
8. Use `tools/call` on storage or hosting for tenant work; use **`shellui storage buckets list`** for a REST cross-check with the same human session.

## 22. `x-mcp` on REST operations

Every opted-in operation publishes:

```yaml
x-mcp:
  read_only: true|false
  destructive: true|false
  sensitive: true|false
```

**Read only** tools map to safe HTTP methods. **Destructive** forces a fresh approval even in `full` agent mode when `mcp_destructive` is false. **Sensitive** plus **`mcp_read=safe`** masks personal fields. **`x-mcp-secret`** response properties never reach agents. There is no bypass that turns a write into a read; registration is explicit in code, not tag-only ([storage `docs/mcp.md`](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md)).

## 23. Internal approval pipeline (service to identity)

1. Service posts **`mcp-approval-requests`** with a signed assertion and redacted arguments.
2. Gateway or human surfaces pending state.
3. Human or elicitation supplies **`allow` / `deny` / `allow_session`** on the internal decide path when applicable.
4. Service polls **`mcp-approval-state`** until `approved`.
5. Service executes the write and posts **`mcp-approval-consume`** with `approval_id` (atomic, single use, within the **10 minute** window in the handbook).
6. On deny or expiry the tool stays **failed**; there is no silent success.

## 24. Who holds which token

| Actor                      | Token                                 | Typical use                                                |
| -------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| Person in browser or shell | Identity **human** JWT                | `shellui` CLI, shell Settings, `GET /api/v1/mcp/approvals` |
| MCP agent                  | Identity **agent** JWT per `aud`      | `POST …/mcp` JSON-RPC                                      |
| ai gateway                 | Delegation JWT + downstream agent JWT | Forward `tools/call`                                       |
| CI preview                 | Hosting **deploy** token              | `shellui deploy` only                                      |

## 25. Email operators (MCP)

See [email `docs/mcp.md`](https://github.com/shellui/email-service/blob/develop/docs/mcp.md) for template CRUD, rules, Actions webhooks, and preview render. **Render-preview** does not send mail; **send-test** targets the owner address when rules allow. Dev mail lands in Mailpit.

## 26. Handbook index (`develop`)

| Topic                                           | File                                                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Identity OAuth, exchange, approvals, revocation | [docs/mcp-and-agents.md](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md) |
| AI gateway                                      | [docs/mcp.md](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)                             |
| Storage tools                                   | [docs/mcp.md](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md)                        |
| Hosting tools                                   | [docs/mcp.md](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md)                        |
| Email tools                                     | [docs/mcp.md](https://github.com/shellui/email-service/blob/develop/docs/mcp.md)                          |

Published copies also render under [docs.shellui.com](https://docs.shellui.com) when your docs build tracks `main` or the configured ref ([Docs site](/docs-site)).

## Related

- [Authentication](/features/authentication)
- [CLI](/cli)
- [SDK](/sdk)
- [Local dev stack](/dev-stack)
- [Identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)
