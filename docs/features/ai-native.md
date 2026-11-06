---
title: AI native platform (global SaaS, regional MCP, human CLI)
sidebar_label: AI native platform
description: End-to-end Shellui MCP, OAuth, approvals, regional delegation, SaaS REST paths, local compose, and troubleshooting. Sources are identity, ai, storage, hosting, email handbooks and this repository.
---

This guide ties together **global** control plane (SaaS), **regional** data plane (identity, storage, hosting, email, ai gateway), and the **human** CLI. It cites **published handbook files** on `develop` where we could read them with `gh api` and **this repo** for the shell and CLI.

Rules for this page: **Shellui** naming, hyphen `-` for pauses, straight `"`, ellipsis `…`, no banned filler from the [writing guidelines](https://shellui.com/guidelines/writing.md).

## One-line mental model

You have **one human identity** in regional identity-service (OAuth). That identity can hold **memberships** in regional companies (numeric ids). Separately, the **global** SaaS plane holds dashboard records (UUIDs in API responses), regions, endpoints, and **global MCP** for account-level tools. **No** single credential can call every surface: each token has a narrow `aud`, `company_id`, and scope. Regional shells exchange to app sessions with RFC 8693. Global MCP agent JWTs exchange down to regional agent JWTs with RFC 8693 at `POST /oauth/mcp/token` on the regional identity (see handbook). **AI-service** is the per-company MCP gateway: it aggregates downstream tools as `service_toolname` (one underscore) and never stores identity signing keys ([ai-service `docs/mcp.md`](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md), [identity `docs/mcp-and-agents.md`](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)).

## Preconditions you cannot skip

1. **Human account** completed sign-in on identity (not a deploy token, not an agent JWT).
2. **Accepted Terms of Service** (and any other **global** legal gates your operator configures) **before** you create dashboard companies, bind regions, or authorize **any** MCP agent (global or regional). Identity’s MCP sign-in and consent flows assume a normal member; there is no parallel “agent-only” path that skips legal state.
3. **Staff** (`user_metadata.is_staff` true) **cannot** authorize MCP OAuth ([identity MCP handbook](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)). Staff **cannot** use the email link on `/oauth/mcp/signin`. Treat **denied** as **expected**, not misconfiguration.

## Where to read the contracts

| Topic                                                              | Canonical file                                                                                                               |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| OAuth, exchange, approvals, revocation, internal assertions        | [identity-service `docs/mcp-and-agents.md`](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md) |
| Gateway aggregation, elicitation, session allow, downstream tokens | [ai-service `docs/mcp.md`](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)                                   |
| Storage tools, `x-mcp`, connectors                                 | [storage-service `docs/mcp.md`](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md)                         |
| Hosting tools, domains, env, logs                                  | [hosting-service `docs/mcp.md`](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md)                         |
| Email tools, templates, rules, actions                             | [email-service `docs/mcp.md`](https://github.com/shellui/email-service/blob/develop/docs/mcp.md)                             |
| Shell Settings HTTP (today)                                        | `packages/core/src/features/mcp/personalAgentsApi.ts`, `mcpToolApprovalsApi.ts`                                              |

Interactive OpenAPI on each running service: **`GET /api/schema/`**, **`GET /api/docs/`** (see each service’s `docs/api.md` or index).

SaaS-service **repository** is not readable with the GitHub token available to this agent (`404` on `repos/shellui/saas-service/contents/...`). Treat **SaaS OpenAPI on your running container** (`http://localhost:8005/api/schema/`) as the source for global MCP and REST. The **dashboard** in compose sets `DASHBOARD_API_URL` to `PUBLIC_SAAS_URL` ([`dev/docker-compose.yml`](https://github.com/shellui/shellui/blob/develop/dev/docker-compose.yml)).

## Local compose URLs (verified from this repo)

These come from [`dev/docker-compose.yml`](https://github.com/shellui/shellui/blob/develop/dev/docker-compose.yml) and [`dev/.env.local.example`](https://github.com/shellui/shellui/blob/develop/dev/.env.local.example):

| Role                    | Published URL           | In-network base        |
| ----------------------- | ----------------------- | ---------------------- |
| Shell                   | `http://localhost:4000` | `shell` container      |
| identity                | `http://localhost:8001` | `http://identity:8000` |
| storage                 | `http://localhost:8002` | `http://storage:8000`  |
| hosting                 | `http://localhost:8003` | `http://hosting:8000`  |
| email                   | `http://localhost:8004` | `http://email:8000`    |
| SaaS                    | `http://localhost:8005` | `http://saas:8000`     |
| ai gateway              | `http://localhost:8006` | `http://ai:8000`       |
| Global dashboard (Vite) | `http://localhost:5174` | n/a                    |

**CORS for SaaS browser calls:** `SAAS_CORS_ALLOWED_ORIGINS` must list the shell and dashboard origins ([Local dev stack](/dev-stack#saas-api-cors)).

**No fake success:** if a sibling service fails to build or a route returns `4xx`/`5xx`, the CLI and MCP stack surface that failure. This doc does not promise `200` with empty demo data.

## Identifiers (do not mix)

| Kind                 | Shape          | Example                                | Used by                                                          |
| -------------------- | -------------- | -------------------------------------- | ---------------------------------------------------------------- |
| Regional company id  | Decimal string | `1` (seed), `2` when you add a company | JWT `company_id`, `GET /api/v1/companies/`, `…/c/<id>/mcp` on ai |
| Dashboard company id | UUID           | from `shellui projects list`           | SaaS dashboard JSON, `…/saas/api/v1/companies/<uuid>/` in CLI    |
| Global agent id      | UUID           | from SaaS or identity admin            | Global agent token `agent_id`, provisioning revoke payload       |
| Human `sub`          | string         | identity user id                       | Human JWT only                                                   |

CLI split is implemented in [`packages/cli/src/commands/projects.js`](https://github.com/shellui/shellui/blob/develop/packages/cli/src/commands/projects.js): **`projects list|get`** use the **dashboard** prefix `saas/api/v1`. **`projects regions|endpoints`** use **`api/v1`** on the same SaaS origin ([`saas-paths.js`](https://github.com/shellui/shellui/blob/develop/packages/cli/src/http/saas-paths.js)).

**Direct REST** (MCP `path` arguments, curl, integration tests) use the **canonical** SaaS API routes on the same host:

- `GET|POST /api/v1/companies`, `GET|PATCH /api/v1/companies/{uuid}`, …
- `GET /api/v1/regions/`
- `GET /api/v1/companies/{uuid}/endpoints/`

Confirm shapes on **`/api/schema/`** for your SaaS revision. The **`saas/api/v1`** prefix is the **dashboard mount** the CLI uses so the SPA and CLI share one list view without reinventing paths.

## SaaS global MCP (OAuth, not the Streamable URL)

**Important:** `https://<saas>/.well-known/...` and `https://<saas>/oauth/mcp/*` describe **OAuth**. They are **not** the Streamable HTTP MCP JSON-RPC URL.

Per operator target on **develop**, the SaaS host exposes at minimum:

| Surface                                       | Purpose                                                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /.well-known/oauth-protected-resource`   | `resource` metadata for global MCP (RFC 9728 style)                                                                                                           |
| `GET /.well-known/oauth-authorization-server` | Authorization server metadata for the SaaS MCP realm                                                                                                          |
| `POST /oauth/mcp/register`                    | Dynamic client registration                                                                                                                                   |
| `POST /oauth/mcp/authorize`                   | Browser step with **PKCE S256**; human must present a valid **identity** bearer context where the product ties global authorization to the same human account |
| `POST /oauth/mcp/token`                       | `authorization_code` and refresh for **global** agent tokens                                                                                                  |

**Regional** MCP clients instead start from ai-service per-company metadata (`GET /.well-known/oauth-protected-resource/c/<company_id>/mcp`) and use identity’s `/.well-known/oauth-authorization-server` ([identity handbook](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md), [ai handbook](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)).

**Bearer interchange is false:** a regional agent JWT with `aud={REGIONAL_STORAGE}/mcp` is **not** valid on SaaS `POST /mcp`. A human identity JWT is **not** an MCP agent JWT. Exchange explicitly per RFC 8693 where the handbook allows ([identity global agent exchange section](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)).

**Global MCP workloads:** account-level companies, regions, endpoints, projects, **not** bucket bytes or tarballs. Those stay on storage and hosting `POST /mcp` with storage or hosting `aud`.

**Setup delegation:** product requirement: SaaS-issued setup tokens should carry a **company-specific** `setup_context_company_id` (or equivalent) so a global step cannot attach to the wrong tenant. **Field name and presence** are **not** finalized in a public file this agent can read (SaaS repo private to this token); track the operator patch (for example cloud agent `bc-6aca6696`) and **read OpenAPI** on your SaaS container before relying on it.

## Regional MCP URL (ai-service gateway)

Canonical per company:

```http
POST http://localhost:8006/c/2/mcp
```

Replace `2` with your **regional** id (`shellui companies list`). Plain `POST http://localhost:8006/mcp` answers **`404`** `company_required` ([ai handbook](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)).

Protected resource metadata:

```http
GET http://localhost:8006/.well-known/oauth-protected-resource/c/2/mcp
```

`resource` must match the `aud` claim on the agent token. Wrong company in the URL → **401** even if the JWT is otherwise valid.

## OAuth registration and consent (regional, identity AS)

Abbreviated from [identity `docs/mcp-and-agents.md`](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md):

1. Client reads ai-service protected resource metadata, then identity `/.well-known/oauth-authorization-server`.
2. `POST /oauth/mcp/register` (unless disabled: `MCP_DYNAMIC_CLIENT_REGISTRATION=false` or `Company.mcp_allow_dynamic_registration=false`).
3. Browser opens `GET /oauth/mcp/authorize` with **PKCE S256** and RFC 8707 `resource={AI_PUBLIC_URL}/c/<id>/mcp`.
4. Signed-out users hit `/oauth/mcp/signin` (email link; **staff blocked**).
5. After sign-in, identity checks **membership**, then shows consent (company name). **Approve** is manual.
6. `POST /oauth/mcp/token` exchanges the code; access token **`aud`** is the per-company MCP URL; **`company_id`** is in claims.

Redirect rules, anti-phishing copy, `X-Frame-Options`, CSRF, and rate limits are **normative** in that file.

## Global agent token exchange to regional (RFC 8693)

Identity on a **region** accepts:

```http
POST /oauth/mcp/token
Content-Type: application/json

{
  "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
  "subject_token": "<global agent JWT>",
  "subject_token_type": "urn:ietf:params:oauth:token-type:access_token",
  "company_id": "2",
  "resource": "http://localhost:8002/mcp",
  "access_mode": "read_only",
  "read_level": "safe",
  "allow_destructive": false,
  "services": ["identity", "storage"]
}
```

Optional `access_mode`, `read_level`, `allow_destructive`, and `services` may **narrow** the global agent, **never broaden** ([identity handbook](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)). Wrong role or missing `GLOBAL_*` settings → **404** on that endpoint.

When SaaS revokes a global agent, it must call `POST /api/v1/provisioning/global-agents/revoke` in each region with the provisioning assertion so regional rows unlink.

## Access levels and read levels

From [identity handbook](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md):

| `mcp_access` | Behavior                                                                              |
| ------------ | ------------------------------------------------------------------------------------- |
| `read_only`  | read-only tools                                                                       |
| `ask`        | writes enqueue approval                                                               |
| `full`       | writes run unless tool is destructive and `allow_destructive_without_asking` is false |

| `mcp_read`  | Behavior                               |
| ----------- | -------------------------------------- |
| `safe`      | mask sensitive strings                 |
| `sensitive` | richer fields; still no stored secrets |

OpenAPI markers on each service:

```yaml
x-mcp:
  read_only: true|false
  destructive: true|false
  sensitive: true|false
```

Response fields may use `x-mcp-secret` (never returned) and `x-mcp-sensitive` (mask in safe mode) ([storage `docs/mcp.md`](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md), [hosting `docs/mcp.md`](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md), [email `docs/mcp.md`](https://github.com/shellui/email-service/blob/develop/docs/mcp.md)).

## Approvals: internal pipeline (services → identity)

Write tools that need a human create rows through signed **service assertions** ([identity handbook](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)):

| Step               | Route                                             | Notes                                                                |
| ------------------ | ------------------------------------------------- | -------------------------------------------------------------------- |
| Create             | `POST /api/v1/mcp/internal/mcp-approval-requests` | Assertion `mcp.approval.create`                                      |
| State              | `POST /api/v1/mcp/internal/mcp-approval-state`    | `pending`, `approved`, `denied`, `expired`                           |
| Consume            | `POST /api/v1/mcp/internal/mcp-approval-consume`  | **Single use**, `select_for_update`, body `{"approval_id":"<uuid>"}` |
| Elicitation decide | `POST /api/v1/mcp/internal/mcp-approval-decide`   | `allow`, `deny`, `allow_session` (non-destructive session rules)     |

Pending rows **expire** (handbook: **10 minutes** for the standard internal pipeline). After approval, the **same** tool call must be retried; hosting verifies consumption ([hosting `docs/mcp.md`](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md)).

### Gateway elicitation (ai-service)

On `tools/call`, writes may return `_meta.shellui_approval` with **Allow**, **Deny**, **Allow for this session** (non-destructive only). Retry carries `params._meta.shellui_approval.decision` ∈ `allow` | `deny` | `session_allow` ([ai handbook](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)). **`session_allow`** maps to the internal `allow_session` path. **Destructive** tools return **409** if you send `session_allow`.

Session allow lasts **60 seconds** per **`Mcp-Session-Id`** connection (`MCP_APPROVAL_SESSION_TTL_SECONDS`, clamped **30–60** in identity). Identity exposes `mcp-approval-session-check` and `mcp-approval-session-revoke`.

**Setup-class approvals (first company, long window):** product policy targets an **absolute** deadline (commonly **12 minutes** / **720 seconds** of authority) with **no rolling extension** on the same grant. If remaining time on that setup grant drops **below 600 seconds**, the product may **reduce** the normal 60 second session allowance rather than widening scope. Destructive actions still need a **fresh** approval each time. **Exact** JSON for setup flows is **SaaS-specific**; read **`/api/schema/`** on SaaS (private source repo here).

### Human member APIs (identity, today)

Company owners and the member who created the agent decide approvals:

| Method | Path                                                                 |
| ------ | -------------------------------------------------------------------- | -------- |
| `GET`  | `/api/v1/mcp/approvals?company_id=`                                  |
| `GET`  | `/api/v1/mcp/approvals/{id}`                                         |
| `POST` | `/api/v1/mcp/approvals/{id}/decide` with `{"decision":"approve"      | "deny"}` |
| `POST` | `/api/v1/mcp/approvals/{id}/approve` and `…/reject` (same semantics) |

This matches [`mcpToolApprovalsApi.ts`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/mcpToolApprovalsApi.ts) in the shell today.

Some products want a **`session_allow` boolean** on the **human** decide endpoint for parity with internal `allow_session`. That is **not** in the shell’s fetch helper today; track [shellui#182](https://github.com/shellui/shellui/issues/182) (or the identity change) and **OpenAPI** before you rely on extra fields.

In-chat clients use identity **`POST /api/v1/mcp/internal/mcp-approval-decide`** with **`allow_session`** for the short 60 second non-destructive window. The [ai-service handbook](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md) notes dependency on identity **#134 or equivalent** for decide and session-check wiring in some releases; match the pair of images you deploy.

### Example (illustrative SaaS tool name)

A **first company create** tool (name is **`tools/list` output**, not invented here) might return:

```json
{
  "meta": {
    "pending_approval_id": "660e8400-e29b-41d4-a716-446655440000",
    "expires_at": "2026-11-06T10:10:00Z"
  }
}
```

Human approves with **Bearer: human JWT** (Settings calls the same host the product configures):

```http
POST http://localhost:8001/api/v1/mcp/approvals/660e8400-e29b-41d4-a716-446655440000/decide
Authorization: Bearer <human access token>
Content-Type: application/json

{"decision":"approve"}
```

Then the agent **retries the same** `tools/call`; the service consumes the approval server-side. **Deny** or **expiry** → **fail closed**; there is **no** local “assume allowed” mode.

Global approval plane is **owner-only** for high-risk operations; confirm `403` on non-owner JWT in OpenAPI tests.

## Revocation (bounded immediacy)

- Human routes: `POST /api/v1/mcp/agents/{id}/pause`, `…/revoke` ([identity handbook](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)).
- Services poll `GET /api/v1/mcp/internal/mcp-revocations` with a signed assertion, **`cache_seconds`** in the signed payload, **30 second** consumer cache called out in hosting and email handbooks. Revocation applies on the **next successful poll**; design for **retry** after `403` once caches catch up.

## Downstream token mint (ai → identity → storage or hosting)

ai-service calls `POST /api/v1/mcp/internal/mcp-downstream-access-token` with a **delegation JWT** signed by ai (`AI_SERVICE_ISSUER`, JWKS on ai `/.well-known/jwks.json`). Identity returns `{ "access_token": "…" }` with `aud` exactly the downstream `/mcp` URL ([identity handbook](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)).

## `list_services` (identity `POST /mcp`)

Tool **`list_services`** returns configured downstream MCP URLs (storage, hosting, email, SaaS, AI, identity) from live settings ([identity handbook](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)). Downstream minting uses **only** those configured origins.

## OpenAPI tool names (authoritative discovery)

**Authoritative names** come from `tools/list` on the live gateway or service. ai-service exports downstream tools as `<service>_<tool>` with **one underscore** ([ai handbook](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)).

**Examples** taken from hosting handbook text (verify with `tools/list` on your build):

- `hosting_v1_apps_create`
- `hosting_v1_apps_deployments_create`
- `hosting_v1_apps_deployments_artifact_upload_url_create`
- `hosting_v1_apps_deployments_artifact_upload_complete_create`
- `hosting_v1_apps_deployments_finalize_create`

Storage handbook lists areas (connectors, objects, grants); **exact** ids are in OpenAPI / `tools/list`.

**Never** paste undocumented `storage_storage_v1…` names from memory. Run **`tools/list`**.

## Hosting MCP (domains, env, logs)

See [hosting `docs/mcp.md`](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md):

- **Domains:** TXT instructions, `verified` / `serving` honest about platform state.
- **Env:** values encrypted at rest; list returns `value_present`, not secret bytes.
- **Runtime logs:** may return `source: none` with `unavailable_reason` for static sites.
- **Request logs:** paginated when enabled (`HOSTING_REQUEST_LOG_ENABLED`).
- **Deploy flow:** presign PUT → bytes off MCP → complete → finalize (MCP never carries tarball bytes).

Revocation polling and approvals **fail closed** if identity assertions cannot be verified.

## Storage MCP (connectors and objects)

See [storage `docs/mcp.md`](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md): connectors with configuration checks, objects, grants, share links (not anonymous redeem), Actions webhooks, quotas. **Metrics** routes are **not** MCP tools.

## Email MCP (templates, rules, sends)

See [email `docs/mcp.md`](https://github.com/shellui/email-service/blob/develop/docs/mcp.md): template CRUD, `send-test`, rules, Actions webhooks. **Required** `aud` `{EMAIL_PUBLIC_URL}/mcp` and `scope` includes `email`.

## Shell Settings UI and activity (this repo)

**Status:** `GET /api/v1/mcp/personal/status?company_id=` → `mcp_enabled`, `mcp_url`, optional `global_identity` ([`personalAgentsApi.ts`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/personalAgentsApi.ts)). A future identity change may add `global_mcp_url` and richer aggregates; until your identity revision includes those keys, **do not** assert them in integration tests.

**Activity rows** accept structured fields (`access_kind`, `outcome`, `resource_label`, `company_name`, `approval_request_id`, `error_message`, …). Missing fields fall back to conservative display. **`error_message`** is passed through `sanitizeMcpActivityErrorMessage` (query strip, substring redaction) **today**; richer **approved metadata** may land with Settings work ([shellui#179](https://github.com/shellui/shellui/pull/179), [shellui#182](https://github.com/shellui/shellui/issues/182)).

## Human CLI (merged on `develop`)

Uses **`shellui login`** human OAuth session (PKCE loopback), **not** `SHELLUI_DEPLOY_TOKEN`.

[`docs/cli.md`](https://github.com/shellui/shellui/blob/develop/docs/cli.md) is canonical. Summary:

| Command                     | Target                       | Notes                                       |
| --------------------------- | ---------------------------- | ------------------------------------------- | ------------------------------------------------- | ------------------------ | ------------------------------------------------ | -------------------------------- |
| `shellui companies list     | get                          | use`                                        | identity `GET /api/v1/companies/`, `GET /…/{id}/` | **Regional** decimal ids |
| `shellui projects list      | get                          | use                                         | regions                                           | endpoints`               | SaaS `…/saas/api/v1/companies/…` or `…/api/v1/…` | **UUID** for dashboard companies |
| `shellui storage buckets …` | storage `/storage/v1/bucket` | **JWT** carries `company_id`; no query hack |
| `shellui hosting apps …`    | hosting `/hosting/v1/apps`   | same                                        |
| `shellui projects create`   | n/a                          | **not implemented** (`not_implemented`)     |

`SHELLUI_DEPLOY_TOKEN` is **only** for **`shellui deploy`** preview flows ([CLI](/cli)). It is **not** an MCP bearer and **not** a substitute for `shellui login`.

## Personal agents (optional `saas` scope)

`POST /api/v1/mcp/personal/agents/create` includes `services` (`identity`, `storage`, `hosting`, `email`, optional `saas`; ai is added server-side). When `global_identity` is false, the shell **strips** `saas` before POST ([`personalAgentsApi.ts`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/personalAgentsApi.ts)).

## Regional app sessions (shell, RFC 8693)

Embedded apps using `provider: "upstream"` exchange the **human shell token** for a **regional** token ([Authentication](/features/authentication#regional-identity-servers-token-exchange)). That path is for **people-driven** sessions in iframes, parallel to but **distinct from** MCP agent exchanges.

## Rebuild and smoke (local)

1. Pull `develop` on **shellui** and every sibling in [Local dev stack](/dev-stack#1-clone-the-repos-side-by-side).
2. `cd shellui/dev && ./start.sh` (runs `generate-env.sh` then `docker compose --env-file .env.local up --build`).
3. Human login to the shell, finish **ToS** in the **global** dashboard if your stack gates on it.
4. In a terminal with project config:  
   `shellui login`  
   `shellui companies list` → expect seed `1` unless you added tenants.  
   `shellui projects list` → expect **UUID** rows when SaaS is wired.

5. Open **`http://localhost:8005/api/docs/`** on SaaS and **`http://localhost:8006/api/docs/`** on ai with a browser to confirm OpenAPI matches the commits you built.

## What you can build (scenarios)

- **Operator agent (regional gateway):** read buckets and request logs, open an approval for `hosting_v1_apps_deployments_finalize_create`, wait for owner decision, then finalize. Use **safe** read level until you accept sensitive mail or PII exposure.
- **Account agent (global SaaS MCP OAuth):** list regions and endpoints, enqueue **first company** provisioning, bind **setup_context_company_id** once SaaS exposes it in token claims, then exchange to regional agents for storage or hosting work.
- **Email governance:** adjust templates and rules over MCP with `ask` mode so every write still hits identity approvals.

## Troubleshooting (concrete)

| Symptom                                   | Likely cause                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `invalid_grant` on token                  | Authorization code replay, wrong `redirect_uri`, expired code, or wrong `code_verifier`           |
| `403` on regional MCP                     | Wrong `company_id` in URL vs token, membership missing, **staff** bearer, or **ToS** not accepted |
| `401` with `resource_metadata` on ai      | Missing or wrong `aud`; use exact per-company URL                                                 |
| `404` on `POST /oauth/mcp/token` exchange | Region missing `GLOBAL_*` trust for global agent exchange                                         |
| `403` on SaaS dashboard fetch             | CORS list missing; or human session is not a **member** of the dashboard company                  |
| Approval stuck pending                    | Row expired (~10 minutes default internal); destructive tool denied session shortcut              |
| `409` on session allow                    | Destructive tool cannot use `session_allow`                                                       |
| Poll starvation                           | Revocation cache (30s) plus Redis or network; **fail closed** while identity unreachable          |

## Identity `POST /mcp` tools

Identity’s own Streamable HTTP endpoint is **`POST {ISSUER}/mcp`**. It exposes **non-admin** tools such as **`list_services`** (URLs for storage, hosting, email, SaaS, AI, identity `/mcp`). **Pause**, **revoke**, **approve**, and **call-log admin** routes stay **human-only** (`allow_agent_token=false`) ([identity handbook](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)).

## Service `POST /mcp` endpoints (regional)

| Service       | Streamable HTTP                         | Protected resource                                                          |
| ------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| storage       | `POST http://localhost:8002/mcp`        | `GET http://localhost:8002/.well-known/oauth-protected-resource`            |
| hosting       | `POST http://localhost:8003/mcp`        | `GET http://localhost:8003/.well-known/oauth-protected-resource`            |
| email         | `POST http://localhost:8004/mcp`        | `GET http://localhost:8004/.well-known/oauth-protected-resource`            |
| ai gateway    | `POST http://localhost:8006/c/<id>/mcp` | `GET http://localhost:8006/.well-known/oauth-protected-resource/c/<id>/mcp` |
| SaaS (global) | `POST http://localhost:8005/mcp`        | `GET http://localhost:8005/.well-known/oauth-protected-resource`            |

**`aud` must match** the `resource` URL including `/mcp` (RFC 8707). email requires **`scope` includes `email`** and `aud = {EMAIL_PUBLIC_URL}/mcp` ([email handbook](https://github.com/shellui/email-service/blob/develop/docs/mcp.md)).

## Agent access token claims (regional)

From [identity `docs/mcp-and-agents.md`](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md):

| Claim             | Meaning                                                                            |
| ----------------- | ---------------------------------------------------------------------------------- |
| `aud`             | One downstream `/mcp` URL                                                          |
| `sub`             | `agent:{uuid}`                                                                     |
| `agent_id`        | Agent uuid                                                                         |
| `company_id`      | Regional tenant                                                                    |
| `scope`           | Space-separated service ids (`identity`, `storage`, `hosting`, `email`, `saas`, …) |
| `mcp_access`      | `read_only`, `ask`, `full`                                                         |
| `mcp_read`        | `safe` or `sensitive`                                                              |
| `mcp_destructive` | When true, allows destructive tools without extra approval in `full` mode          |

Refresh with `grant_type=refresh_token` at `POST /oauth/mcp/token` and the **same** `resource` parameter.

## Global agent JWT (shape)

When SaaS issues **global agent** access tokens (RS256 from the **global** issuer), required claims include `token_type: agent_access`, `agent_id` (global uuid), `email_verified: true`, `user_metadata.is_staff: false`, and service scopes ([identity handbook table](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)). **Regional** exchange refuses staff the same way it refuses staff for user exchange.

**Note:** the handbook file still contains one line that global mint on SaaS was **not implemented** at the time that sentence landed. Use **`/api/schema/`** on your SaaS process plus Git history to see whether mint is live in your deployment.

## Personal agent HTTP (regional identity, shell integration)

These are **human** flows inside Settings (Bearer human token, optional `saas` service when `global_identity` is true) ([`personalAgentsApi.ts`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/personalAgentsApi.ts)):

| Action   | `GET` or `POST` path                                        |
| -------- | ----------------------------------------------------------- |
| Status   | `GET /api/v1/mcp/personal/status?company_id=`               |
| List     | `GET /api/v1/mcp/personal/agents?company_id=`               |
| Create   | `POST /api/v1/mcp/personal/agents/create?company_id=`       |
| Revoke   | `POST /api/v1/mcp/personal/agents/{id}/revoke?company_id=`  |
| Activity | `GET /api/v1/mcp/personal/agents/{id}/activity?company_id=` |

**Staff** cannot call `/api/v1/mcp/*` member admin APIs ([identity handbook](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)).

## Approval fallback page

If a client cannot show elicitation, identity exposes:

```http
GET /oauth/mcp/approval/{id}?token=…
```

The `token` parameter is **signed**; only **Approve** and **Deny** appear ([identity handbook](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)).

## Call logs

Services forward redacted rows to `POST /api/v1/mcp/internal/mcp-call-logs`. Owners read with `GET /api/v1/mcp/call-logs` ([identity handbook](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)).

## Internal assertion callers (trusted issuers)

Identity verifies RS256 assertions from downstream services ([identity handbook registry](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)):

| Caller                        | Issuer env               |
| ----------------------------- | ------------------------ |
| ai                            | `AI_SERVICE_ISSUER`      |
| storage                       | `STORAGE_SERVICE_ISSUER` |
| hosting                       | `HOSTING_SERVICE_ISSUER` |
| email                         | `EMAIL_SERVICE_ISSUER`   |
| dashboard (SaaS provisioning) | `PROVISIONING_ISSUER`    |

Wrong issuer, wrong key, or replayed `jti` → **401**. Service mismatch on approval → **403**.

## shellui-django wiring (services)

The identity handbook lists the shared package tasks: mount `POST /mcp`, export tools from OpenAPI `x-mcp`, protected-resource metadata, revocation polling, rate limits ([identity handbook tail](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)).

## ai-service gateway details

From [ai `docs/mcp.md`](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md):

- When `SAAS_SERVICE_URL` is set, protected resource metadata can include `shellui_mcp_authorize_query: {"saas_offered":"1"}` so clients add `saas_offered=1` on `GET /oauth/mcp/authorize` (optional SaaS scope at consent).
- Plain `/mcp` and root protected-resource `404` with `company_required`.
- **`AI_PUBLIC_URL`** sets the advertised origin for `aud` (set behind proxies).
- Without ai signing keys, revocation polling and call logs **fail closed**.
- Large audits: see `mcp-tool-schema-audit.md` in ai-service for per-tool `inputSchema` review counts.

## `/api/v1/mcp/personal/status` (future fields)

Product target after identity merges additional response keys: **`global_mcp_url`**, stricter **`aud`** binding per resource, aggregated **service display names**. Ship **only** after your identity revision documents those keys in **OpenAPI**; the shell parser today accepts unknown fields but does not render them.

## OAuth errors (MCP clients)

Typical failure strings (exact spelling depends on identity version):

| Error                                 | Meaning                                                               |
| ------------------------------------- | --------------------------------------------------------------------- |
| `invalid_grant`                       | Code replay, PKCE mismatch, wrong `redirect_uri`, expired code        |
| `invalid_scope`                       | Requested scopes or `resource` not allowed for that client or company |
| `invalid_request`                     | Missing `resource`, malformed PKCE, bad `client_id`                   |
| `access_denied`                       | User clicked **Deny** on consent                                      |
| `server_error`                        | Identity internal fault; retry with new authorize                     |
| HTTP `404` on authorize after sign-in | Unknown company id in `/c/<id>/mcp` resource                          |
| HTTP `403` on member APIs             | Staff bearer, non-owner on owner-only action, or missing membership   |

## Membership and `company_id` pitfalls

- `shellui companies list` shows **only** companies your **human** token can see. A new company row in SaaS that is not linked to your regional membership produces **empty CLI lists** or **403** until provisioning finishes.
- `shellui projects endpoints` needs a **dashboard UUID** (`shellui projects use <uuid>` or pass the uuid argument). Passing a **regional decimal** returns **404** from SaaS.

## Human vs agent capabilities

| Capability                               | Human JWT              | Agent JWT           |
| ---------------------------------------- | ---------------------- | ------------------- |
| Approve MCP rows in Settings             | yes (owner or creator) | **no**              |
| `shellui login` CLI                      | yes                    | **no**              |
| `tools/call` on hosting                  | no                     | yes, with approvals |
| Pause or revoke agents in identity admin | yes (policy)           | **no**              |

## Tenant selection rule

Regional MCP picks the company **only** from the URL path (`/c/<company_id>/mcp`). There is **no** query override and no default company ([identity handbook](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)).

## Progressive tool discovery

1. Call `tools/list` on ai-service for the company.
2. Call `tools/list` on an individual service if you bypass the gateway (advanced debugging).
3. Read **`x-mcp`** flags before you automate a tool.
4. Run **`GET /api/v1/actions/events`** (storage or hosting Actions) to see webhook catalog entries when you wire automation (handbooks: [Storage webhooks](https://docs.shellui.com/storage/actions), [Hosting webhooks](https://docs.shellui.com/hosting/actions)).

## Observability differences

- **MCP call logs:** identity-stored, argument-redacted ([identity handbook](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)).
- **Shellui Actions deliveries:** per-service outbox with retries ([Storage webhooks](https://docs.shellui.com/storage/actions)).
- **Metrics:** Prometheus endpoints on services are **not** MCP tools ([storage `docs/mcp.md`](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md)).

## Browser global OAuth vs MCP transport

Global SaaS OAuth (`/oauth/mcp/*`) is **HTTPS-first** with **loopback** exceptions as documented for MCP redirects ([identity handbook](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)). A headless agent **must** implement the same discovery, registration, and PKCE flow a desktop MCP client uses. There is **no** hidden Shellui-owned **Approve** shortcut in this repository’s CLI.

## Compose environment (excerpt, MCP and SaaS)

From this repo’s [`dev/docker-compose.yml`](https://github.com/shellui/shellui/blob/develop/dev/docker-compose.yml) and [`dev/.env.local.example`](https://github.com/shellui/shellui/blob/develop/dev/.env.local.example):

| Variable                                                                   | Role                                                                                                                                                    |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_SAAS_URL`                                                          | Browser origin for SaaS (`http://localhost:8005`), issuers, CORS                                                                                        |
| `IDENTITY_DASHBOARD_WEBHOOK_URL`                                           | `${PUBLIC_SAAS_URL}/api/v1/webhooks/local` (identity → SaaS webhook URL)                                                                                |
| `IDENTITY_DASHBOARD_WEBHOOK_INTERNAL_URL`                                  | `http://saas:8000/api/v1/webhooks/local` (in-network)                                                                                                   |
| `PROVISIONING_ISSUER` on identity                                          | Matches `${PUBLIC_SAAS_URL}` so SaaS assertions identify as dashboard                                                                                   |
| `PROVISIONING_SIGNING_KEY` / `PROVISIONING_PUBLIC_KEY`                     | RS256 for SaaS → identity trusted caller rows                                                                                                           |
| `GLOBAL_ISSUER_URL`, `GLOBAL_JWKS`, `GLOBAL_ACCESS_TOKEN_AUDIENCE`         | Regional identity trusts shell issuer for **user** token exchange ([Authentication](/features/authentication#regional-identity-servers-token-exchange)) |
| `GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`                                       | Separate audience for **global agent** JWT verification (set on region per handbook)                                                                    |
| `AI_SERVICE_ISSUER`, `AI_SERVICE_JWKS_URL`                                 | ai-service assertion verification on identity                                                                                                           |
| `STORAGE_SERVICE_ISSUER`, `HOSTING_SERVICE_ISSUER`, `EMAIL_SERVICE_ISSUER` | Downstream MCP internal callers                                                                                                                         |
| `SAAS_CORS_ALLOWED_ORIGINS`                                                | Comma-separated **browser** origins allowed to call SaaS JSON from the shell and dashboard                                                              |

Internal URLs in compose (`http://saas:8000`, `http://identity:8000`) **do not** go through `SAAS_CORS_ALLOWED_ORIGINS`.

## Example HTTP shapes (illustrative)

**List dashboard companies with the human CLI session** (see `dashboardServiceFetch`):

```http
GET http://localhost:8005/saas/api/v1/companies/
Authorization: Bearer <human access token from shellui login>
```

**Same data plane path without the dashboard prefix** (when a product or OpenAPI uses direct `api/v1`):

```http
GET http://localhost:8005/api/v1/companies
Authorization: Bearer <human access token>
```

Compare status codes and bodies on both paths in **`/api/schema/`**; the shell CLI intentionally uses `saas/api/v1` for `projects list` only ([`projects.js`](https://github.com/shellui/shellui/blob/develop/packages/cli/src/commands/projects.js)).

**Regional regions catalog:**

```http
GET http://localhost:8005/api/v1/regions/
Authorization: Bearer <human access token>
```

**Endpoints for one dashboard UUID:**

```http
GET http://localhost:8005/api/v1/companies/550e8400-e29b-41d4-a716-446655440000/endpoints/
Authorization: Bearer <human access token>
```

## Global MCP tool example (name unverified)

SaaS **tool names** change with OpenAPI. A plausible **first company** tool (replace with `tools/list` output on your SaaS build) could look like:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "saas_api_v1_companies_create",
    "arguments": {
      "path": "/api/v1/companies",
      "method": "POST",
      "body": { "name": "Example", "region": "ch" }
    }
  },
  "id": 1
}
```

Expect `_meta` or response payload to carry **`pending_approval_id`** when write gating applies; complete the **human** decision on identity (`POST /api/v1/mcp/approvals/{id}/decide` today) or the **SaaS-documented** variant once OpenAPI shows extra fields. **Always** run `tools/list` on **`http://localhost:8005/mcp`** for authoritative names.

## Grant version and status endpoint (pending contract)

Identity change sets may add **`grant_version`** (or similarly named) checks on agent JWTs and expand `GET /api/v1/mcp/personal/status` with **`global_mcp_url`**, stricter **`aud`**, or aggregate labels. **This shell repository does not parse those fields yet** beyond optional extras in JSON. Track [identity-service#135](https://github.com/shellui/identity-service/pull/135) and **OpenAPI** before you assert behavior in automated tests.

## Cross-links to raw handbooks on GitHub

| Document                | URL                                                                               |
| ----------------------- | --------------------------------------------------------------------------------- |
| Identity MCP and agents | `https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md` |
| AI gateway              | `https://github.com/shellui/ai-service/blob/develop/docs/mcp.md`                  |
| Storage MCP             | `https://github.com/shellui/storage-service/blob/develop/docs/mcp.md`             |
| Hosting MCP             | `https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md`             |
| Email MCP               | `https://github.com/shellui/email-service/blob/develop/docs/mcp.md`               |

## Merge checklist (operators)

1. Confirm **identity**, **ai**, **storage**, **hosting**, **email**, and **saas** images all reference the same **`shellui-django[mcp]`** minor line your release notes cite.
2. Rotate **dev-only** `PROVISIONING_*` keys after any accidental leak from `dev/.env.local` (never commit that file).
3. Run **`tools/list`** on **ai** and on **SaaS** after each upgrade; diff tool names when CI fails.
4. Exercise **one** real `read_only` tool and **one** `ask` write per service in staging before broad agent access.
5. File issues when OpenAPI **`x-mcp`** flags disagree with runtime behavior; the flag drives human expectations for approvals.

## Related

- [Authentication](/features/authentication) (human token exchange to apps)
- [Security](/features/security) (human token storage)
- [CLI](/cli) (human session commands)
- [Local dev stack](/dev-stack) (compose, `./start.sh`, env)
- [Application settings](/features/application-settings) (where MCP panels mount in the shell)
