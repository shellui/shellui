---
title: AI native platform (control plane, data plane, MCP)
sidebar_label: AI native platform
description: Ordered workflow, global SaaS versus regional services, identity MCP HTTP routes, sessions, approvals, CLI scope, and local compose URLs.
---

This page is for **operators and integrators**. It states **ordering rules** you cannot skip, lists **HTTP paths this repo implements** (`@shellui/cli`, `@shellui/core`), and points to **live OpenAPI** on each service. It flags **in-flight** identity and ai-service work so you do not treat design targets as shipped behavior until those pull requests merge.

## Preconditions (mandatory order)

1. **Human account** exists and is signed in through normal identity OAuth (not an MCP agent).
2. **Terms of Service** (and any other global legal gates your deployment enforces) are **accepted before** you create a company, attach regions, or register any MCP agent (global or regional). There is no optional branch here.
3. **Staff accounts** (`is_staff` / operator identities) are **never** authorized as MCP agents. Identity **refuses** personal and OAuth MCP credentials for staff principals. Do not describe staff as "extra gates"; they are **out of scope** for agent tokens.

If any step above is incomplete, stop. No regional provisioning flow and no MCP `create` fixes that.

## Contract status (check before you rely on wording)

| Area                                            | Source                                                                                   | State (this writing)                                                                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| SaaS global MCP URLs (`/mcp`, `/oauth/mcp`)     | saas-service (not cloned in this workspace); API inaccessible from the GitHub token here | **Pending** confirmation in OpenAPI after [saas-service#32](https://github.com/shellui/saas-service/pull/32) and related merges |
| Grant versioning / immediate revoke on mismatch | [identity-service#135](https://github.com/shellui/identity-service/pull/135)             | **Open** (not merged at last check)                                                                                             |
| MCP approvals / setup session TTL alignment     | [ai-service#24](https://github.com/shellui/ai-service/pull/24)                           | **Open** (not merged at last check)                                                                                             |
| Storage connector + MCP parity                  | [storage-service#58](https://github.com/shellui/storage-service/pull/58)                 | **Merged** (verify on your tag)                                                                                                 |
| Hosting domains / env / logs (MCP-related ops)  | [hosting-service#77](https://github.com/shellui/hosting-service/pull/77)                 | **Merged** (verify on your tag)                                                                                                 |

Re-read OpenAPI after upgrading images. Handbooks under [Docs site](/docs-site) are fetched from default branches and may trail a hotfix branch.

## Identifiers you must not confuse

- **Regional company id:** decimal string, same as JWT `company_id` and `shellui companies list`. Local seed in compose is company **`1`** ([Local dev stack](/dev-stack#sign-in)). If you create another company, run `shellui companies list` and use that id. This doc uses **`2` only as a numeric demo** where a second company exists.
- **Dashboard company UUID:** RFC 4122 UUID returned by SaaS list paths. `shellui projects list` reads them. Never pass a regional decimal id to a path that expects a UUID.

## Architecture (compose hostnames)

Browser and CLI use `PUBLIC_*_URL` from [dev/.env.local.example](https://github.com/shellui/shellui/blob/develop/dev/.env.local.example). Published ports in [dev/docker-compose.yml](https://github.com/shellui/shellui/blob/develop/dev/docker-compose.yml):

| Role                           | Default URL             |
| ------------------------------ | ----------------------- |
| Shell                          | `http://localhost:4000` |
| identity                       | `http://localhost:8001` |
| storage                        | `http://localhost:8002` |
| hosting                        | `http://localhost:8003` |
| email                          | `http://localhost:8004` |
| saas (API + dashboard backend) | `http://localhost:8005` |
| ai (regional MCP gateway)      | `http://localhost:8006` |
| Global dashboard Vite          | `http://localhost:5174` |

Docker DNS names (`http://identity:8000`, `http://saas:8000`, …) are for east-west calls only.

```mermaid
flowchart TB
  subgraph browser["Browser"]
    Shell["Shell :4000"]
    Dash["Dashboard :5174"]
  end
  subgraph global["Global plane"]
    SaaS["saas :8005"]
  end
  subgraph regional["Regional plane"]
    Id["identity :8001"]
    AI["ai :8006"]
    St["storage :8002"]
    Ho["hosting :8003"]
    Em["email :8004"]
  end
  Shell -->|Bearer JWT OAuth| Id
  Dash -->|Bearer same login session| SaaS
  Shell -->|aiService.url| AI
  Id -->|MCP token + approvals| AI
  Id -->|JWT verify| St
  Id -->|JWT verify| Ho
  Id -->|JWT verify| Em
```

**Global control plane (SaaS):** account-level records (dashboard companies as UUIDs), projects, regions, endpoints, billing-shaped data. **AI-service does not read application file bytes or bucket objects through MCP**; it invokes downstream tools with tokens bound to allowed services. App data stays in regional storage and hosting.

**Regional data plane:** tenant objects (files, apps, mail pipelines) scoped by **regional** `company_id`.

## SaaS HTTP surface (two prefixes on one host)

The CLI treats `saas.url` or `SHELLUI_SAAS_URL` as the **origin** (default `http://localhost:8005` when unset). Dashboard-scoped JSON uses the **`saas/api/v1`** prefix; legacy or shared segments use **`api/v1`** on the **same host** (see `saasDashboardPath` / `saasApiV1Path` in `packages/cli/src/http/saas-paths.js`).

| Purpose                  | Example (local)                                                |
| ------------------------ | -------------------------------------------------------------- |
| List dashboard companies | `GET http://localhost:8005/saas/api/v1/companies/`             |
| One dashboard company    | `GET http://localhost:8005/saas/api/v1/companies/{uuid}/`      |
| Regions catalog          | `GET http://localhost:8005/api/v1/regions/`                    |
| Company endpoints        | `GET http://localhost:8005/api/v1/companies/{uuid}/endpoints/` |

`shellui projects` issues those calls with the **same Bearer session** as `shellui login` (`dashboardServiceFetch`). It does **not** send `company_id` query parameters on these routes.

**CORS:** `SAAS_CORS_ALLOWED_ORIGINS` in `dev/.env.local` must include the shell and dashboard origins (see [Local dev stack](/dev-stack#saas-api-cors)).

## Global MCP (SaaS) versus regional MCP (ai-service)

- **Regional company MCP (implemented in this repo’s clients):** Streamable HTTP endpoint  
  `{PUBLIC_AI_URL}/c/{regional_company_id}/mcp`  
  Example: `http://localhost:8006/c/2/mcp`. Built by `buildCompanyMcpUrl` in `@shellui/core`.
- **Global MCP (account- or dashboard-scoped tools on SaaS):** expected at  
  `{PUBLIC_SAAS_URL}/mcp`  
  with OAuth metadata at  
  `{PUBLIC_SAAS_URL}/oauth/mcp`  
  when saas-service exposes them ([saas-service#32](https://github.com/shellui/saas-service/pull/32)). **Do not assume** those routes return 200 until you verify your deployment’s `/api/schema/` or published handbook.

**Connection preference:** use **OAuth** with the MCP client when the server advertises it. Personal agent **static tokens** from identity are a fallback for clients that cannot do OAuth; they are still **scoped and time-bounded**, not a master credential.

## Identity MCP HTTP routes (implemented by `@shellui/core`)

All of these use `Authorization: Bearer <shell access token>` and, where noted, `company_id` as a **query** parameter for the **regional** tenant.

| Operation                 | Method and path                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| MCP feature flag and URLs | `GET /api/v1/mcp/personal/status?company_id=`                                                   |
| List personal agents      | `GET /api/v1/mcp/personal/agents?company_id=`                                                   |
| Create personal agent     | `POST /api/v1/mcp/personal/agents/create?company_id=`                                           |
| Revoke                    | `POST /api/v1/mcp/personal/agents/{id}/revoke?company_id=`                                      |
| Activity                  | `GET /api/v1/mcp/personal/agents/{id}/activity?company_id=`                                     |
| Pending approvals         | `GET /api/v1/mcp/approvals?company_id=`                                                         |
| Decide approval           | `POST /api/v1/mcp/approvals/{id}/decide?company_id=` with JSON `{"decision":"approve"\|"deny"}` |

Response shapes are parsed in `packages/core/src/features/mcp/personalAgentsApi.ts` and `mcpToolApprovalsApi.ts`.

### Optional `saas` service on personal agents

When identity returns `global_identity: true`, `@shellui/core` keeps **`saas`** in the personal agent service list; otherwise it strips `saas` before `POST …/agents/create`. There is still **no** cross-tenant parameter you can set by hand: the server binds companies and grants.

## Sessions and approvals (design targets versus UI today)

**Design targets** being finalized in identity and ai-service:

- **New-company setup session:** wall-clock **720 seconds (12 minutes)** for the **allowed session only**; renewals may issue a new session but **must not** extend the original absolute deadline (no "rolling forever" on the same grant).
- **Non-destructive tool call on an existing connection:** about **60 seconds** for the **current pending approval** only.
- **Destructive tools:** require a **fresh** human approval for each attempt (not optional, not reusable from an earlier Allow).

Until [identity-service#135](https://github.com/shellui/identity-service/pull/135) and [ai-service#24](https://github.com/shellui/ai-service/pull/24) land, treat TTL fields in OpenAPI as authoritative; **do not** cite this page as proof the timers are enforced in production.

### Approval loop (fail closed)

1. Tool call runs → identity creates a **pending approval** row (if policy requires it).
2. Human polls or uses **Settings → MCP / AI agents → Pending approvals** (same data as `GET /api/v1/mcp/approvals`).
3. Human calls `POST …/decide` with `approve` or `deny`.
4. Server **consumes** the approval id; a second use is a hard error.
5. Only after **approve** does the tool execute. **Deny**, **expiry**, or **missing approval** keeps the operation **denied**; there is **no** local-only fallback.

**Global-plane writes** (SaaS MCP tools that change org-wide state) are expected to require **company owner** membership and the same atomic consume rule. Confirm `403` semantics on your branch.

## Revocation (do not guess "wait out the TTL")

Designed behavior (per in-flight identity work): personal tokens and company **grants** carry a **version**. Authorization checks compare the live version; **revocation bumps the version** so the next check **fails immediately**, independent of JWT `exp`. Agent revocation and company grant revocation are distinct concepts but both must invalidate outstanding tool calls.

**Do not** tell operators that a revoked token "might still work until expiry" while [#135](https://github.com/shellui/identity-service/pull/135) is open. After merge, verify with the published OpenAPI and a live test.

## Activity rows (API fields the shell understands)

`@shellui/core` maps **snake_case** activity payloads into `McpAgentActivityRow` (`packages/core/src/features/mcp/personalAgentsApi.ts`):

- `timestamp`, `tool`, `service`, `result` (required strings for a row to display)
- `client_ip`
- `company_id`, `company_name` (safe labels)
- `resource_label` (sanitized description of the target; no secrets baked in by the API)
- `actor`, `agent_name`
- `access_kind` → `read` | `write` | `destructive` | `unknown` (aliases normalized in the parser)
- `duration_ms`
- `outcome` → `allowed` | `denied` | `failed` | `pending_approval` | `session_used` | `unknown`
- `approval_request_id`
- `error_message` (short service error text)

The Settings UI **additionally** runs `error_message` through `sanitizeMcpActivityErrorMessage`: URL query strings are stripped, messages that resemble leaked credentials become `[Error details redacted]`, and long text is truncated. That is **not** a promise that the API sends secrets; it is a **client-side guard**. Raw tool arguments and env blobs are **not** rendered.

When `access_kind` or `outcome` is missing, the UI may infer display labels from tool name and `result` string (`inferActivityAccessKind`, `parseActivityOutcome`). Prefer fixing the API to emit explicit enums.

### Known tool labels (UI registry only)

`mcpToolActivityRegistry.ts` lists friendly titles for a **small** set of tool names (`identity_list_users`, `hosting_deploy`, `storage_delete`, …). Anything outside the map stays **verbatim** until identity publishes a canonical tool catalog.

## Regional delegation (RFC 8693)

Embedded apps that use a **regional** identity server receive tokens **only** from that server after **token exchange** from the shell token. See [Regional identity servers (token exchange)](/features/authentication#regional-identity-servers-token-exchange). There is **no** single master JWT for every service.

## CLI versus global MCP writes (merged in `develop`)

Human CLI commands use the **OAuth session** from `shellui login`, not `SHELLUI_DEPLOY_TOKEN`, not MCP agent tokens. Full command table: [CLI](/cli#shellui-projects-action-id-root).

Short summary:

| Command area                  | Calls                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `shellui companies`           | identity `GET /api/v1/companies/`, `GET /api/v1/companies/{id}/`                                                                            |
| `shellui projects`            | SaaS `GET …/saas/api/v1/companies/`, `…/saas/api/v1/companies/{uuid}/`, `GET …/api/v1/regions/`, `GET …/api/v1/companies/{uuid}/endpoints/` |
| `shellui storage buckets`     | storage `GET /storage/v1/bucket`, `GET /storage/v1/bucket/{name}`                                                                           |
| `shellui hosting apps`        | hosting `GET /hosting/v1/apps`, `GET /hosting/v1/apps/{slug}`                                                                               |
| `shellui hosting deployments` | hosting deployment list and status routes (see [CLI](/cli))                                                                                 |

`shellui projects create` exits `not_implemented`; provisioning belongs to the **dashboard UI** or **global MCP OAuth** once enabled.

Configure `saas: { "url": "…" }` or `SHELLUI_SAAS_URL`; default base is `http://localhost:8005` when unset.

## Feature coverage (REST and operators)

Use each service’s **`/api/schema/`** and **`/api/docs/`** on the **localhost** port from compose. Below is a **sketch** of REST surfaces MCP tools wrap; it is not the MCP tool name list.

### hosting-service (merged ops work)

From the published handbooks [Hosting API](https://docs.shellui.com/hosting/api) and [Storage API](https://docs.shellui.com/storage/api):

- App lifecycle: `GET/POST /hosting/v1/apps`, uploads, finalize, rollback, preview
- Deploy tokens: `GET/POST /hosting/v1/deploy-tokens`, revoke
- Domains, env, encrypted values, and operator logs as per your deployed OpenAPI (see [#77](https://github.com/shellui/hosting-service/pull/77))
- Health: `GET /hosting/v1/health` (no token) versus metrics and stats (token-gated; see handbook tables)

Runtime logs and DNS state at the **edge provider** are still **provider-dependent**; this repo only documents the hosting-service surface.

### storage-service (connector + lifecycle)

Handbook lists buckets, objects, grants, share links, WebDAV, metrics, and Actions admin routes ([Storage API](/storage/api)). Connector and external bucket checks landed in [#58](https://github.com/shellui/storage-service/pull/58); confirm fields on your schema.

### email-service

REST mail API (`/api/v1/send`, catalog, events) uses service keys and JWT rules from [email handbook](/email). **Do not assume** an MCP tool sends mail just because a policy "allows" email; verify the ai-service tool list and idempotency rules on `http://localhost:8006/api/schema/` when [#24](https://github.com/shellui/ai-service/pull/24) merges.

## End-to-end local workflow (concrete)

1. Pull **develop** on every sibling repo listed in [Local dev stack](/dev-stack#1-clone-the-repos-side-by-side).
2. `cd shellui/dev && ./start.sh` (or `generate-env.sh` then `docker compose … up --build`).
3. Sign **Terms** and complete **account** steps in the **global dashboard** (`http://localhost:5174`) until the UI shows a clean tenant (no pending legal gate).
4. Sign in to the **shell** (`http://localhost:4000`), open **Settings → MCP / AI agents**, and **only then** create a personal or OAuth agent.
5. Approve or deny pending tools in the same Settings panel; watch `expires_at` from the API.
6. **Read-only check with CLI:**  
   `shellui login`  
   `shellui companies list`  
   Expect the seeded regional id `1` unless you created more companies. For SaaS UUIDs: `shellui projects list` (needs `saas.url` or default `8005`).

## MCP client examples

**Regional (company 2 demo):**

```json
{
  "mcpServers": {
    "shellui-regional-demo": {
      "url": "http://localhost:8006/c/2/mcp",
      "headers": {
        "Authorization": "Bearer your_personal_agent_token_here"
      }
    }
  }
}
```

**Global (only after SaaS exposes OAuth for MCP):** configure the client against `http://localhost:8005/oauth/mcp` (discovery) and register a dynamic client; **do not** paste long-lived secrets into shared JSON.

## Troubleshooting (accurate symptoms)

| Symptom                        | Check                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `403` on SaaS from dashboard   | `SAAS_CORS_ALLOWED_ORIGINS` contains `http://localhost:5174` and the shell origin; you finished ToS; you use a **member** JWT |
| `403` on MCP `create` as staff | Expected: staff must not receive agent tokens                                                                                 |
| Pending tool never executes    | Approval denied, expired, or wrong `company_id` on `GET /api/v1/mcp/approvals`                                                |
| CLI `projects list` fails      | Logged in? `saas.url` reachable? SaaS returns JSON for `/saas/api/v1/companies/` on your tag                                  |

Do **not** instruct anyone to "wait for access token expiry" after **revoke** once [#135](https://github.com/shellui/identity-service/pull/135) ships grant checks.

## Related pages

- [Authentication](/features/authentication) - token exchange
- [Security](/features/security) - token storage
- [CLI](/cli) - `shellui companies`, `shellui projects`, SaaS path prefixes
- [Local dev stack](/dev-stack) - `./start.sh`, ports, `SAAS_CORS_ALLOWED_ORIGINS`
- [Application settings](/features/application-settings) - Settings surfaces
