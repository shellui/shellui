---
title: AI native platform (global SaaS MCP, regional gateway, human CLI)
sidebar_label: AI native platform
description: Task map for global SaaS MCP, regional gateways, CLI, iframe SDK, and service MCP recipes on develop.
---

This page ties together global SaaS, regional services, and Shellui surfaces. For every tool name and body field, use `tools/list` and `GET /api/schema/` on the host in your deployment.

## Audience and prereqs

You run the [local dev stack](/dev-stack). You sign in as a normal member through the shell, not as staff. Staff cannot finish MCP OAuth ([identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)).

## Sign-in and Terms

Use `/login` in the shell ([Authentication](/features/authentication)). Accept Terms of Service when gated. In this repo the route is `/legal/terms-of-service` ([urls](https://github.com/shellui/shellui/blob/develop/packages/core/src/constants/urls.ts)). Your global dashboard may use another path for the same acceptance.

## Two company ids

Regional tenants use a decimal id in the identity JWT `company_id`. Example: `1` in `GET http://localhost:8001/api/v1/companies/1/`. Dashboard records use a SaaS company UUID from `shellui projects list`. SaaS exposes `regional_company_id` on the Company when provisioned. Use that decimal in `POST http://localhost:8006/c/1/mcp`. Never pass the dashboard UUID in the ai gateway path.

## Authoritative develop references

- Identity: open [PR 135](https://github.com/shellui/identity-service/pull/135) tracks live approval authority, `grant_version`, and global MCP URL documentation; align with that branch until it merges.
- Shellui: [PR 24](https://github.com/shellui/shellui/pull/24) (merged) documents the tiny CDN SDK surface; full iframe flow stays in [SDK](/sdk) on `develop`.
- Global SaaS MCP contract: [saas-service docs/mcp.md](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md) on develop (paths and tool names there override informal notes).

## Local stack and global trust keys

`cd path/to/shellui/dev` then `./start.sh`. The generator writes `dev/.env.local` with a dev JWKS. JSON Web Key Set (JWKS) lists public keys for verifying signed tokens offline. Compose sets `GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`. Identity receives `PUBLIC_SAAS_URL` as `GLOBAL_ISSUER_URL`, `GLOBAL_JWKS`, and that audience ([dev stack global agent JWT trust](/dev-stack#global-agent-jwt-trust-dev)). Saas-service must sign agent access tokens with the matching key and `aud`. Exact SaaS env names follow saas-service `develop`.

## Three agent surfaces

Global MCP on SaaS is one OAuth and JSON-RPC stack for control plane tools. After consent you call `POST http://localhost:8005/mcp`. Regional MCP uses identity OAuth and `POST http://localhost:8001/oauth/mcp/token` for browser flows, or RFC 8693 exchange from a global agent JWT ([Global agent token exchange](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)). Storage, hosting, and email each expose `POST …/mcp` for direct regional agents. Personal agents from Settings are regional identity tokens, not the global unified stack.

## Discovery and OAuth on SaaS (global)

```http
GET http://localhost:8005/.well-known/oauth-protected-resource
GET http://localhost:8005/.well-known/oauth-authorization-server
```

Read `GET http://localhost:8005/api/schema/` for OAuth client and token routes. Shellui-hosted global flows use a trusted handoff: human signed into Shellui with ToS done, then POST consent with Bearer. Generic inspectors may not drive that POST without the same session.

## Global consent is POST with human Bearer

Global consent uses `POST` on SaaS `mcp_authorize` with JSON `client_id`, `redirect_uri`, `code_challenge`, `code_challenge_method` S256, optional `state`, `company_id`, `agent_name`, `access_mode`, `read_level`, `allow_destructive`, `services`, plus `Authorization: Bearer` with the identity human access token after ToS acceptance. The handler returns `redirect_to` with `code` and `state`. Exchange with `POST http://localhost:8005/oauth/mcp/token` and `grant_type=authorization_code`. There is no browser `GET` authorize on SaaS for this flow. Regional identity still uses `GET /oauth/mcp/authorize` for standard MCP clients ([identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)). Global SaaS MCP tools and pending approvals are defined in [saas-service docs/mcp.md](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md) on develop.

## First company and global approval

The creator must already be eligible for membership in the target region per operator policy.

Call `api_v1_companies_create` through `POST http://localhost:8005/mcp`. Pending responses use `status` `pending` and `approval_id` in `result.meta` ([saas-service docs/mcp.md](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md)). A human POSTs to `http://localhost:8005/api/v1/mcp/approvals/`, the approval id, then `/decision`, with body `decision` `approve`, `session_allow` `false`, and Bearer auth from identity. Retry the same `tools/call`. Read `regional_company_id` from the Company payload. New-company setup uses a 12 minute ceiling. Non-destructive session allow can span 600 to 900 seconds while more than 600 seconds remain on that grant, else 60 seconds, capped by access and setup expiry, same `Mcp-Session-Id`. Every destructive tool needs a new human approval on each call. Read-only access mode does not offer write or destructive tools.

## Regional ai gateway

```http
GET http://localhost:8006/.well-known/oauth-protected-resource/c/1/mcp
POST http://localhost:8006/c/1/mcp
```

Use your decimal tenant in the path. Downstream tools use names like `storage_toolname` ([ai-service docs/mcp.md](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)).

## Recipe: storage connectors and objects (regional MCP or REST)

Handbook: [storage-service docs/mcp.md](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md), [buckets and objects](https://github.com/shellui/storage-service/blob/develop/docs/buckets-and-objects.md). Schema: `GET http://localhost:8002/api/schema/`.

**Connectors (company owner):** register mounts with `POST /storage/v1/connector`. Body fields include `connector_provider`, optional `connector_settings`, optional `credential` (write-only, never returned on `GET`). Creation runs a local check only; it does not call the provider ([buckets and objects](https://github.com/shellui/storage-service/blob/develop/docs/buckets-and-objects.md)). Detail responses use `connector_last_issue_code` when present. Re-run checks with `POST …/configuration/check`, `…/configuration/validate`, or `…/configuration/retry` (names differ for ergonomics; see OpenAPI).

**Objects (company bucket):** upload with `POST` or `PUT` to `/storage/v1/object/company/{path}` (raw bytes, `Content-Type` set). `PUT` overwrites; `POST` conflicts unless `x-upsert` is true ([buckets and objects](https://github.com/shellui/storage-service/blob/develop/docs/buckets-and-objects.md)). Download with `GET` on the same object path per schema. List with `POST /storage/v1/object/list/company` or the MCP tool that maps to it.

**Storage Shellui Actions:** webhook payloads for uploads and deletes are in [Webhooks](https://github.com/shellui/storage-service/blob/develop/docs/actions.md) on storage-service develop.

**JSON-RPC** on `POST http://localhost:8002/mcp` uses `initialize`, `tools/list`, `tools/call`. Send a Bearer agent token on every request ([storage MCP](https://github.com/shellui/storage-service/blob/develop/docs/mcp.md)). The `tools/call` name and `arguments` keys come from `tools/list` and OpenAPI. Email-service shows the normalized shape ([email MCP example JSON-RPC](https://github.com/shellui/email-service/blob/develop/docs/mcp.md)).

**Human CLI (session, not agent provisioning):** from the repo root, `node packages/cli/bin/shellui.js storage buckets list` and `storage buckets get` ([CLI](/cli)). These calls use the logged-in CLI session; they do not replace MCP agent OAuth.

**Iframe SDK (human session):** after `shellui.init()`, `shellui.storage.from('company').upload(...)` and `list(...)` as in [SDK](/sdk).

## Recipe: hosting site, deploy artifact, domains, env, logs

Handbook: [hosting-service docs/mcp.md](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md). Schema: `GET http://localhost:8003/api/schema/`.

**Deploy states (explicit sequence):** each step is an MCP `tools/call` except the byte upload, which uses HTTPS PUT outside JSON-RPC ([hosting MCP deploy walkthrough](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md)):

1. `hosting_v1_apps_create` or `hosting_v1_preview_create` or `hosting_v1_apps_list` / `hosting_v1_apps_retrieve`
2. `hosting_v1_apps_deployments_create` with `app_version` and `shellui_version`
3. `hosting_v1_apps_deployments_artifact_upload_url_create` returns `upload_url`, `method` `PUT`, `headers`, `requires_bearer`
4. `PUT` the `.tar.gz` to `upload_url` with those headers. When `requires_bearer` is true, send the same agent Bearer on the PUT. Do not send the archive through MCP
5. `hosting_v1_apps_deployments_artifact_upload_complete_create`
6. `hosting_v1_apps_deployments_finalize_create`

The legacy `PUT /hosting/v1/apps/{app_ref}/deployments/{id}/upload` route remains for the CLI and deploy tokens; it is not an MCP tool ([hosting MCP](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md)).

**Custom domains:** `GET/POST /hosting/v1/apps/{app_ref}/domains`, `GET/DELETE …/domains/{domain_id}`, `POST …/domains/{domain_id}/refresh`. Responses keep `verified` and `serving` false until platform integration confirms provisioning ([hosting MCP](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md)).

**Environment variables:** `GET/POST /hosting/v1/apps/{app_ref}/environment`, `GET/PUT/DELETE …/environment/{key}`. List and read return `key`, `value_present`, `updated_at` only. Write bodies mark `value` with `x-mcp-secret` ([hosting MCP](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md)).

**Logs:** `GET …/logs/runtime` may return `source: none` and `unavailable_reason` for static sites. `GET …/logs/requests` pages with `cursor` and `limit` when enabled ([hosting MCP](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md)).

**Previews:** preview sites use a 7-day TTL (`HOSTING_PREVIEW_TTL_DAYS`) ([hosting MCP](https://github.com/shellui/hosting-service/blob/develop/docs/mcp.md)).

**CLI:** `node packages/cli/bin/shellui.js hosting apps list`, `hosting deployments list`, `hosting deployments status` with a deployment id ([CLI](/cli)). `deploy` uses preview flow and deploy tokens, not MCP agent tools.

## Recipe: email templates, rules, Actions, and status

Handbook: [email-service docs/mcp.md](https://github.com/shellui/email-service/blob/develop/docs/mcp.md). Schema: `GET http://localhost:8004/api/schema/`.

Agent JWT needs `aud` equal to `{EMAIL_PUBLIC_URL}/mcp` and `scope` including `email` ([email MCP](https://github.com/shellui/email-service/blob/develop/docs/mcp.md)).

**Templates:** list, versions, publish, `POST …/render-preview` (does not send mail), and `POST …/send-test` (one message to the owner) are tabulated in [email MCP](https://github.com/shellui/email-service/blob/develop/docs/mcp.md). Optional body keys for render-preview include `number`, `document`, `subject`, `preheader`, `theme`, and `variables`.

**Rules:** `GET/POST /api/v1/rules`, `GET/PATCH/DELETE /api/v1/rules/{rule_id}` ([email MCP](https://github.com/shellui/email-service/blob/develop/docs/mcp.md)).

**Shellui Actions webhooks:** `GET/POST /api/v1/actions/rules`, deliveries, event log, and related routes ([email MCP](https://github.com/shellui/email-service/blob/develop/docs/mcp.md)).

**Message status and related catalog tools:** the same OpenAPI schema tags other company-owner routes when they carry `x-mcp` ([email MCP other tools](https://github.com/shellui/email-service/blob/develop/docs/mcp.md)). Resolve exact paths and field names from `GET http://localhost:8004/api/schema/`.

Example `tools/call` for render-preview (tool name from `tools/list` on your deployment):

```json
{
  "name": "api_v1_templates_render_preview",
  "arguments": {
    "path": "/api/v1/templates/{template_id}/render-preview",
    "path_params": { "template_id": "12" },
    "method": "POST",
    "body": { "variables": { "company_name": "Acme" } }
  }
}
```

List tools:

```json
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {} }
```

See [email MCP](https://github.com/shellui/email-service/blob/develop/docs/mcp.md) for a second `tools/call` example using `api_v1_rules_list`. Send the agent Bearer on every `POST /mcp` request.

## Recipe: JSON-RPC and regional service endpoints

| Service     | MCP JSON-RPC                     | Schema                                  |
| ----------- | -------------------------------- | --------------------------------------- |
| Storage     | `POST http://localhost:8002/mcp` | `GET http://localhost:8002/api/schema/` |
| Hosting     | `POST http://localhost:8003/mcp` | `GET http://localhost:8003/api/schema/` |
| Email       | `POST http://localhost:8004/mcp` | `GET http://localhost:8004/api/schema/` |
| Global SaaS | `POST http://localhost:8005/mcp` | `GET http://localhost:8005/api/schema/` |

## Approvals for storage, hosting, email

Create request, poll state until approved, consume with `approval_id`, then run the write ([identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)). Pending rows expire after 10 minutes in that contract. Revocation polling uses about a 30 second cache on consumers. That cache is separate from approval expiry and from signed revocation assertions.

## CLI from the monorepo root (`shellui --help`)

Run:

```bash
node packages/cli/bin/shellui.js --help
```

The published `shellui` binary prints the same text. Below, placeholders that appear as angle brackets in the CLI output are spelled as words (COMMAND, ACTION, ID) so tutorials avoid bare angle brackets. Line length is at most 80 columns.

```text
shellui/0.7.0

Usage:
  $ shellui COMMAND [options]

Commands:
  start [root]
    Start the shellui server (alias: dev)
  build [root]                              Build the shellui application
  init [framework]
    Create a shellui project with interactive wizard
  config ACTION [root]
    Config tools: migrate | split | unsplit
  login [root]
    Sign in to shellui (browser OAuth; stores CLI credentials)
  logout [root]
    Remove stored CLI credentials for this account
  whoami [root]
    Show the profile for the stored CLI credentials
  auth status [root]
    Show login/session status (no tokens)
  companies ACTION [id] [root]
    List or inspect organizations (identity /api/v1/companies)
  projects ACTION [id] [root]
    SaaS dashboard companies and api/v1 regions-endpoints (saas.url; human
```

```text
    session, no company_id query)
  storage buckets ACTION [name] [root]
    List or get storage buckets (storage.url; JWT company claim only, no
    company_id query)
  hosting apps ACTION [ref] [root]
    List hosted sites or get one by slug (hosting.url; JWT company claim only)
  hosting deployments list [root]
    List deployments for a site (hosting.url; slug from --slug or
    hosting.slug)
  hosting deployments status UUID [root]
    Resolve one deployment from list by UUID (no per-deployment GET on
    service)
  deploy [action] [root]
    Deploy dist/web to shellui hosting preview (7-day TTL)

For more info, run any command with the `--help` flag:
  $ shellui start --help
  $ shellui build --help
  $ shellui init --help
  $ shellui config --help
  $ shellui login --help
  $ shellui logout --help
```

```text
  $ shellui whoami --help
  $ shellui auth status --help
  $ shellui companies --help
  $ shellui projects --help
  $ shellui storage buckets --help
  $ shellui hosting apps --help
  $ shellui hosting deployments list --help
  $ shellui hosting deployments status --help
  $ shellui deploy --help

Options:
  -h, --help     Display this message
  -v, --version  Display version number
```

`shellui projects create` is not implemented. Creating dashboard companies stays in global MCP or the dashboard, not the CLI ([CLI](/cli)). `shellui auth status` shows login or session status without printing tokens.

## Activity rows in Settings

Rows show summary text, outcome, and mapped labels for known `error_code` values ([McpAgentActivitySection.tsx](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/settings/components/McpAgentActivitySection.tsx)). `global_mcp_url` is a full `…/mcp` URL for display when identity sends it.

## CORS

`SAAS_CORS_ALLOWED_ORIGINS` affects browsers only. It does not replace Bearer checks.

## Smoke

```bash
node packages/cli/bin/shellui.js login
node packages/cli/bin/shellui.js companies get 1
node packages/cli/bin/shellui.js projects list
```

## Related

- [Authentication](/features/authentication)
- [CLI](/cli)
- [SDK](/sdk)
- [Local dev stack](/dev-stack)
- [Identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)
