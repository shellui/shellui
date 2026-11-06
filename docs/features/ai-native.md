---
title: AI native platform (global SaaS MCP, regional gateway, human CLI)
sidebar_label: AI native platform
description: Task map for global SaaS MCP, regional gateways, CLI, and iframe SDK on develop.
---

This page ties together global SaaS, regional services, and Shellui surfaces. Use it as a map. Use each service handbook and OpenAPI for the full contract.

## Audience and prereqs

You run the [local dev stack](/dev-stack). You sign in as a normal member through the shell, not as staff. Staff cannot finish MCP OAuth ([identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)).

## Sign-in and Terms

Use `/login` in the shell ([Authentication](/features/authentication)). Accept Terms of Service when gated. In this repo the route is `/legal/terms-of-service` ([urls](https://github.com/shellui/shellui/blob/develop/packages/core/src/constants/urls.ts)). Your global dashboard may use another path for the same acceptance.

## Two company ids

Regional tenants use a decimal id in the identity JWT `company_id`. Example: `1` in `GET http://localhost:8001/api/v1/companies/1/`. Dashboard records use a SaaS company UUID from `shellui projects list`. SaaS exposes `regional_company_id` on the Company when provisioned. Use that decimal in `POST http://localhost:8006/c/1/mcp`. Never pass the dashboard UUID in the ai gateway path.

## Local stack and global trust keys

`cd path/to/shellui/dev` then `./start.sh`. The generator writes `dev/.env.local` with a dev JWKS. JSON Web Key Set (JWKS) lists public keys for verifying signed tokens offline. Compose sets `GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`. Identity receives `GLOBAL_ISSUER_URL` (here `PUBLIC_SAAS_URL`), `GLOBAL_JWKS`, and that audience ([dev stack global agent JWT trust](/dev-stack#global-agent-jwt-trust-dev)). Saas-service must sign agent access tokens with the matching key and `aud`. Exact SaaS env names follow saas-service `develop`.

## Three agent surfaces

Global MCP on SaaS is one OAuth and JSON-RPC stack for control plane tools. After consent you call `POST http://localhost:8005/mcp`. Regional MCP uses identity OAuth and `POST http://localhost:8001/oauth/mcp/token` for browser flows, or RFC 8693 exchange from a global agent JWT ([Global agent token exchange](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)). Storage, hosting, and email each expose `POST …/mcp` for direct regional agents. Personal agents from Settings are regional identity tokens, not the global unified stack.

## Discovery and OAuth on SaaS (global)

Fetch metadata from the SaaS host you configure as `PUBLIC_SAAS_URL`.

```http
GET http://localhost:8005/.well-known/oauth-protected-resource
GET http://localhost:8005/.well-known/oauth-authorization-server
```

Read `GET /api/schema/` or `GET /api/docs/` on that host for client registration and token routes. Shellui-hosted global flows expect a trusted handoff: human signed into Shellui with ToS done, then POST consent with Bearer. Generic MCP inspectors may not drive that POST without the same session.

## Global consent is POST with human Bearer

Global consent uses `POST` on SaaS `mcp_authorize` with JSON `client_id`, `redirect_uri`, `code_challenge`, `code_challenge_method` S256, optional `state`, `company_id`, `agent_name`, `access_mode`, `read_level`, `allow_destructive`, `services`, plus `Authorization: Bearer` with the identity human access token after ToS acceptance. The handler returns `redirect_to` with `code` and `state`. Exchange with `POST http://localhost:8005/oauth/mcp/token` and `grant_type=authorization_code`. There is no separate browser `GET` authorize on SaaS for this flow. Regional identity still uses `GET /oauth/mcp/authorize` for standard MCP clients ([identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)).

## First company and approval

The creator must already be eligible for membership in the target region per operator policy. That often means a provisioned owner or member before the first dashboard company exists.

Call `api_v1_companies_create` through `POST http://localhost:8005/mcp`. Pending responses use `status` `pending` and `approval_id` in `result.meta` ([saas-service docs/mcp.md](https://github.com/shellui/saas-service/blob/develop/docs/mcp.md)). A human POSTs to `http://localhost:8005/api/v1/mcp/approvals/` plus the approval id plus `/decision` on SaaS with body `decision` `approve`, `session_allow` `false`, and Bearer auth from identity. Retry the same `tools/call`. Read `regional_company_id` from the Company payload. Setup context stays server-side. New-company setup uses a 12 minute ceiling. Non-destructive session allow can span 600 to 900 seconds while more than 600 seconds remain on that grant, else 60 seconds, capped by access and setup expiry, same `Mcp-Session-Id`. Every destructive tool needs a new human approval on each call. Read-only access mode does not offer write or destructive tools.

## Regional ai gateway

```http
GET http://localhost:8006/.well-known/oauth-protected-resource/c/1/mcp
POST http://localhost:8006/c/1/mcp
```

Use your decimal tenant in the path. Claims must match ([ai-service docs/mcp.md](https://github.com/shellui/ai-service/blob/develop/docs/mcp.md)).

## Approvals for storage, hosting, email

Create request, poll state until approved, consume with `approval_id`, then run the write ([identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)). Pending rows expire after 10 minutes in that contract. Revocation polling uses about a 30 second cache. That cache is separate from approval expiry and from signed revocation assertions.

## Storage file flow without raw tool dumps

List tools with `tools/list` on `POST http://localhost:8002/mcp` or read `GET /api/schema/` on storage. In an iframe use `shellui.init()` then `shellui.storage.from('company').upload(...)` ([SDK](/sdk)). Human CLI can call `shellui storage buckets list` with the same tenant JWT.

## Human CLI

See [CLI](/cli). Examples: `shellui companies get 1`, `shellui projects list`, `shellui projects get` plus a dashboard UUID. `shellui projects create` is not implemented.

## Activity rows in Settings

Rows show summary text, outcome, and mapped labels for known `error_code` values only ([McpAgentActivitySection.tsx](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/settings/components/McpAgentActivitySection.tsx)). `global_mcp_url` is only a full `…/mcp` URL for display when identity sends it.

## CORS

`SAAS_CORS_ALLOWED_ORIGINS` affects browsers only. It does not replace Bearer checks.

## Smoke

```bash
shellui login
shellui companies get 1
shellui projects list
```

## Related

- [Authentication](/features/authentication)
- [CLI](/cli)
- [SDK](/sdk)
- [Local dev stack](/dev-stack)
- [Identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md)
