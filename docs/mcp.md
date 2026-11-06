---
title: Global SaaS MCP reference
sidebar_label: Global SaaS MCP
description: OAuth, tool names, and approvals for the SaaS host MCP endpoint. Companies are called project management in some upstream links; in the Shellui dashboard they are often labeled project.
---

## Scope

This page is about the **global SaaS host** MCP entry point: `POST {saas_origin}/mcp` (Streamable HTTP JSON-RPC) and OAuth discovery on the same origin. It does not replace per-service handbooks; see [identity MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md) for the authorization server and regional flows.

**Vocabulary:** the SaaS API models **companies** (dashboard UI may say **project**). There is no separate OpenAPI family named `api_v1_project_*` for those resources. Names on the wire follow **company** paths (for example `/api/v1/companies/…`). An operation id can still contain `project` when it matches a path segment (verify with `tools/list`).

**Human CLI:** `shellui projects` reads SaaS companies over REST; it does **not** create them. See [CLI](/cli).

## How tool names are built

Services use [shellui-django `shellui_django.mcp`](https://github.com/shellui/django-commons/tree/develop/src/shellui_django/mcp). Only operations tagged **`mcp-tools`** in the OpenAPI schema become MCP tools. The tool **`name`** is derived from the operation `operationId`: non-alphanumeric characters become underscores, lowercased, trimmed to 120 characters (`openapi_tools._slug_tool_name`). There is **no** separate `mcp_tool` prefix in the tool name.

**Do not invent tool ids.** Run **`tools/list`** on `POST {saas_origin}/mcp` with a valid agent Bearer token to see the live catalog for your deployment.

**Examples to verify (not guaranteed):** if the published SaaS schema uses operation ids such as `api_v1_companies_list` and `api_v1_companies_retrieve`, the MCP tool names match those strings. A `GET` for company endpoints may appear as `api_v1_project_endpoints_retrieve` when that is the schema `operationId` for `/api/v1/companies/{uuid}/endpoints/`. Confirm with `tools/list`.

## Setup binding (`setup_context_company_id`)

Some SaaS flows bind a new dashboard company to a **regional** numeric tenant. The active setup or provisioning grant can expose a numeric claim such as **`setup_context_company_id`** for clients to echo only when it matches server state. Treat it as **server-issued** context for first-company setup, not as a free-form client override. Exact shape and presence are defined in the **SaaS** OpenAPI for your release (this repo does not ship saas-service sources).

## Identity status and `global_mcp_url`

When the shell loads MCP settings, identity may return **`global_mcp_url`**: a full URL whose path is exactly **`/mcp`**, used as the global MCP endpoint hint in the UI ([`personalAgentsApi`](https://github.com/shellui/shellui/blob/develop/packages/core/src/features/mcp/personalAgentsApi.ts)). Absence means the shell has no URL to display yet, not that tools are forbidden.

For the full OAuth and token model (authorize, token, refresh, token exchange), see **identity** docs on your deployed revision: [MCP and agents](https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md).

## OAuth and authorization (identity as server)

On the **identity** origin, MCP OAuth is defined in [`config/urls.py`](https://github.com/shellui/identity-service/blob/develop/config/urls.py) and [`apps/agents/oauth_views.py`](https://github.com/shellui/identity-service/blob/develop/apps/agents/oauth_views.py).

| Step               | What to call                                                         | Role                                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovery          | `GET /.well-known/oauth-authorization-server`                        | JSON includes `authorization_endpoint`, `token_endpoint`, `registration_endpoint`                                                                          |
| Protected resource | `GET /.well-known/oauth-protected-resource`                          | JSON includes `resource` (the MCP URL whose `aud` matches tokens)                                                                                          |
| Registration       | `POST /oauth/mcp/register`                                           | Dynamic client registration when enabled                                                                                                                   |
| User consent       | **`GET /oauth/mcp/authorize`** (browser, PKCE + RFC 8707 `resource`) | **Not** a JSON API you call with a human identity Bearer to obtain a code. Unauthenticated users are redirected to identity sign-in (`/oauth/mcp/signin`). |
| Token              | **`POST /oauth/mcp/token`**                                          | `authorization_code` (with `code_verifier`), `refresh_token`, or RFC 8693 token exchange when enabled                                                      |

Optional **SaaS scope at consent** (regional identity with `SAAS_SERVICE_URL` and agent exchange configured): checking **include SaaS** on the consent form can send the user through **global identity** sign-in first (`start_global_identity_signin` → global `/oauth/authorize` → `GET /oauth/mcp/saas-return`), then complete pending consent. That is still **browser OAuth**, not `POST /oauth/mcp/authorize` with a Bearer token.

**Two hops:** the `authorization_endpoint` URL from metadata is the **first** browser step on identity; upstream global IdP sign-in is a **second** hop only when SaaS opt-in requires it ([`mcp_saas_consent.py`](https://github.com/shellui/identity-service/blob/develop/apps/agents/mcp_saas_consent.py), [`mcp_saas_return.py`](https://github.com/shellui/identity-service/blob/develop/apps/agents/mcp_saas_return.py)).

## Write gate and human approval (MCP JSON-RPC)

[`shellui_django.mcp.server.McpServer`](https://github.com/shellui/django-commons/blob/develop/src/shellui_django/mcp/server.py) returns a JSON-RPC **result** with `content` and, when a write needs confirmation, `isError: true` and **`meta`**:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "Approval required." }],
    "isError": true,
    "meta": {
      "approval_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "status": "pending"
    }
  }
}
```

Retry **`tools/call`** with the **same** arguments after a human approves (per-service policy). Pending responses may omit `approval_id` until the server creates the row; always read **`meta.status`**.

Global SaaS approvals and regional service approvals use **different** hosts and APIs. **Shellui Settings** surfaces **regional** identity approvals for connected services. There is **no** single global Settings page in the open-source shell that replaces SaaS-side decisions for global control-plane writes; approved global writes may still require an explicit human step on the SaaS host or operator tooling, depending on your install.

## Tests and references (verified)

- Identity MCP OAuth metadata and protected resource: [`apps/agents/tests/test_mcp_oauth.py`](https://github.com/shellui/identity-service/blob/develop/apps/agents/tests/test_mcp_oauth.py) (`McpOAuthMetadataTests`).
- Token endpoint and authorize wiring: [`config/urls.py`](https://github.com/shellui/identity-service/blob/develop/config/urls.py) (`oauth/mcp/authorize`, `oauth/mcp/token`, …).
- Tool naming rule: [`django-commons` `openapi_tools.py`](https://github.com/shellui/django-commons/blob/develop/src/shellui_django/mcp/openapi_tools.py) (`MCP_TOOL_TAG`, `_slug_tool_name`).
- Approval pending shape: [`server.py`](https://github.com/shellui/django-commons/blob/develop/src/shellui_django/mcp/server.py) (`meta` with `approval_id`, `status`).

## Docs build

From the repo root after `pnpm install`:

```bash
pnpm docs:build
```

This runs `docs:fetch` (service docs) and builds Docusaurus. Fix any reported broken links before release.
