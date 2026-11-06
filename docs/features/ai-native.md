---
title: AI native platform (MCP, control plane, and data plane)
sidebar_label: AI native platform
description: Mental model for Shellui, the global SaaS dashboard, identity-service, ai-service, regional services, MCP agents, tokens, and local development.
---

This page is **conceptual and operational**: it names the services and URLs the local dev stack uses, the HTTP routes `@shellui/core` calls for MCP personal agents and approvals, and honest limits where backends are still coordinated across repositories. It does not replace OpenAPI for any service; generated API docs are fetched into this site (see [Docs site](/docs-site)).

## What you get

You run a **microfrontend shell** (`@shellui/core`) that holds navigation and sign-in. **identity-service** issues OAuth and JWTs for people. **saas-service** backs the global dashboard (projects, regions, members, billing-shaped data): browser traffic uses `PUBLIC_SAAS_URL` in compose (default `http://localhost:8005`). **Regional** services (`storage-service`, `hosting-service`, `email-service`) hold tenant data and operator-facing tools for a **company** in that region. **ai-service** exposes Streamable HTTP MCP per company at `{ai_service_base}/c/{company_id}/mcp` (see `buildCompanyMcpUrl` in the repo). Identity mediates personal MCP agent tokens, approvals, and activity; it is the only place the shell calls for `GET /api/v1/mcp/personal/status`, agent create/list/revoke/activity, and `GET /api/v1/mcp/approvals`.

## Control plane versus data plane

**Global (SaaS) control plane:** accounts, companies, projects, region binding, membership, plans, and hooks that provision regional resources. Human flows that need **Terms of Service** and account state land here before some regional features unlock. The dashboard dev server in compose uses `DASHBOARD_API_URL` / `REGION_LOCAL_*_ORIGIN` against `PUBLIC_SAAS_URL`.

**Regional data plane:** files, apps, domains, and message pipelines for one **regional company id** per deployment. The shell and apps use the regional identity JWT and service bases (`PUBLIC_STORAGE_URL`, `PUBLIC_HOSTING_URL`, `PUBLIC_EMAIL_URL`). RFC 8693 token exchange from a **global** shell session to a **regional** app session is documented under [Regional identity servers (token exchange)](/features/authentication#regional-identity-servers-token-exchange).

There is **no** master token you paste everywhere. Each actor gets **short-lived** credentials: human OAuth tokens for the shell, exchanged regional tokens for apps, and **personal MCP agent** tokens minted by identity with a bounded scope and expiry.

## End-to-end flow (mermaid)

```mermaid
flowchart TB
  subgraph browser ["Browser"]
    Shell["Shell @shellui/core"]
    Dash["Dashboard Vite"]
  end
  subgraph global ["Global plane"]
    SaaS["saas-service :8005"]
  end
  subgraph regional ["Regional plane"]
    Id["identity-service :8001"]
    AI["ai-service :8006"]
    St["storage-service :8002"]
    Ho["hosting-service :8003"]
    Em["email-service :8004"]
  end
  Shell -->|OAuth and API bearer| Id
  Dash -->|CORS + API| SaaS
  Shell -->|aiService.url config| AI
  Id -->|JWKS trust, MCP token mint| AI
  Id -->|service JWT verification| St
  Id -->|service JWT verification| Ho
  Id -->|service JWT verification| Em
  SaaS -->|webhooks / provisioning| Id
```

Inter-container calls use Docker DNS names and port **8000** inside the network (`http://identity:8000`, `http://saas:8000`, …). Browsers use published **localhost** ports from [Local dev stack](/dev-stack).

## One MCP connection per company

Use **one** personal agent or OAuth MCP client per **company** in a given external tool. Duplicate registrations multiply tool names and approval queues. Optional **`saas`** in the allowed services list is only included when identity reports `global_identity: true` for the session (`isGlobalIdentitySession` in `@shellui/core`); otherwise the shell strips `saas` from create payload so regional-only tenants do not receive global-scope tokens.

## Tokens (no shared root secret)

- **Human shell session:** OAuth code flow to identity; access token in memory, refresh in `sessionStorage` by default ([Security](/features/security)).
- **Regional app session:** RFC 8693 exchange posts to `{regional_identity}/oauth/token` with `company_id` ([Authentication](/features/authentication#regional-identity-servers-token-exchange)). Regional identity must trust the global issuer (`GLOBAL_ISSUER_URL`, `GLOBAL_JWKS`, `GLOBAL_ACCESS_TOKEN_AUDIENCE`).
- **Personal MCP agent token:** created with `POST /api/v1/mcp/personal/agents/create` (identity). Response includes `access_token`, `resource` (MCP URL), and `expires_at`. Prefer OAuth on the MCP client when available; use the returned token only as the client’s bearer or static secret field if the client cannot do OAuth.
- **Deploy and agent tokens:** `SHELLUI_DEPLOY_TOKEN` (CLI preview deploy) and MCP agent tokens are different surfaces. Do not treat a deploy token as an MCP credential.

## Where to click in the shell (Settings)

When `aiService.url` is set and identity enables MCP for the company, **Settings** shows **MCP / AI agents** ([Application settings](/features/application-settings)): company MCP base URL (from ai-service), personal connections, **Pending approvals** (`GET /api/v1/mcp/approvals?company_id=…`, `POST /api/v1/mcp/approvals/{id}/decide`), and activity (`GET /api/v1/mcp/personal/agents/{id}/activity`). Exact labels follow the product locale files in `@shellui/core`.

Approval rows use the `expires_at` field from the API; the UI derives **minutes remaining** (`mcpApprovalExpiresInMinutes`). Destructive tools use an explicit confirm path in the UI. **Non-destructive** approvals are short-lived server-side; treat any numeric window as **defined by identity** in your deployment’s OpenAPI, not hard-coded here.

**New-company** onboarding sessions that span SaaS and identity are **bounded** server-side; some material cites a 10 to 15 minute window and a 12 minute figure. Confirm expiry fields in the SaaS and identity OpenAPI for the revision you run.

## REST and OpenAPI parity

MCP exposes **tools**; the same services also expose **REST** (and published OpenAPI). Operators can script against HTTP with the same business rules (authz, company scoping) without going through MCP. Prefer category listing and discovery from the published schema rather than pasting generated tool name lists into docs.

## MCP client configuration (generic)

Shellui does not standardize Cursor, Claude, or ChatGPT config file formats; they change between products. Use the **MCP URL** and **credential** pattern your client documents.

**Cursor / Claude / other JSON MCP servers (illustrative):** set the server `url` to `http://localhost:8006/c/111/mcp` (demo company id `111`) and supply the bearer token the way your client expects (`headers`, `env`, or OAuth). Replace host and company id with yours.

```json
{
  "mcpServers": {
    "shellui-demo-company": {
      "url": "http://localhost:8006/c/111/mcp",
      "headers": {
        "Authorization": "Bearer your_access_token_here"
      }
    }
  }
}
```

**OAuth:** when the client supports dynamic client registration or pre-registered OAuth against identity, prefer that path so tokens rotate. Do not commit **private** keys or long-lived secrets; dev keys from `./generate-env.sh` are **throwaway** and must be rotated if leaked ([Local dev stack](/dev-stack)).

**MCP Inspector:** point the transport at the same URL and attach the bearer token in the tool’s auth panel.

## Agent capabilities versus logs

Personal agents carry `access_mode` (`read_only` | `ask` | `full`), `read_level` (`safe` | `sensitive`), `allow_destructive_without_asking`, and `services_allowed` (from identity). Activity rows may include tool name, service, coarse result text, and client IP when the API returns them. The Settings UI **redacts** strings that look like credential leaks; it does **not** promise full payload logging. Raw tokens **must not** appear in activity; if you need support evidence, reproduce with test IDs and rotate credentials after.

| Surface         | Read                     | Write                                          | Destructive                           | Secrets                                                      |
| --------------- | ------------------------ | ---------------------------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| identity API    | as allowed by membership | account and MCP agent management               | destructive when API allows           | OAuth tokens and MCP agent tokens never logged in full in UI |
| storage-service | bucket and object APIs   | uploads and deletes per policy                 | delete operations are service-defined | storage credentials stay server-side                         |
| hosting-service | app and deployment reads | deploy triggers per policy                     | destructive ops per product rules     | deploy tokens are separate from MCP                          |
| email-service   | template and send reads  | send when allowed                              | destructive data actions per API      | provider credentials server-side                             |
| saas-service    | org and project reads    | provisioning and billing-facing writes per API | depends on route                      | dashboard-facing only                                        |

Provider-specific behavior (DNS at the edge, mailbox delivery, third-party SLAs) is **out of scope** for this repo; defer to that provider’s docs.

## Five-path tutorial (local stack)

Demo ids are labelled **demo**; replace with your company id from identity.

1. **Account and terms:** open the shell at `http://localhost:4000`, complete sign-in, and finish any Terms or staff gates the SaaS dashboard enforces (global plane). Staff accounts may need password sign-in per seed docs ([Local dev stack](/dev-stack#sign-in)).
2. **Global dashboard:** open `http://localhost:5174` with `DASHBOARD_API_URL=http://localhost:8005` (compose default). Create or inspect the **demo** company and project if your SaaS revision exposes those routes.
3. **Add a regional agent:** in the shell **Settings → MCP / AI agents**, create a **personal** connection with desired services (optional `saas` when `global_identity` is true). Copy the MCP URL and token only into your local MCP client.
4. **Approve non-destructive setup:** when a tool asks for approval, use **Pending approvals** in Settings; allow or deny before `expires_at`. Refresh the list if it is empty but the client still waits.
5. **Inspect storage and hosting:** call regional REST with the same company-scoped identity session (or use CLI against storage and hosting bases when your CLI build includes those commands). Read-only checks first.

## CLI mirror (coordination)

`shellui companies`, `shellui projects`, `shellui storage buckets`, and `shellui hosting` commands are proposed in [shellui/shellui#178](https://github.com/shellui/shellui/pull/178) with optional `saas.url` / `SHELLUI_SAAS_URL`. Until that PR merges, treat CLI paths as **preview** and validate against SaaS OpenAPI on your branch.

## Troubleshooting matrix

| Symptom                              | Likely cause                                              | What to check                                                                                                                         |
| ------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **401** on SaaS from dashboard       | Missing or expired bearer, wrong origin                   | Sign-in flow, cookies, `SAAS_CORS_ALLOWED_ORIGINS` includes dashboard and shell origins ([Local dev stack](/dev-stack#saas-api-cors)) |
| **403** on regional APIs             | Not a member of `company_id`, or staff blocked before ToS | Company membership in identity; complete global ToS if required                                                                       |
| Pending approval never clears        | Clock skew, expired approval, wrong company in query      | Compare client `company_id` with shell config; poll identity approvals API                                                            |
| Empty MCP tool list                  | AI down, wrong URL, token scope                           | `docker compose logs ai`, MCP URL pattern `/c/{id}/mcp`, identity `mcp_enabled`                                                       |
| Global vs regional confusion         | Same human, different JWT audiences                       | Use token exchange for regional apps; use personal MCP token only for MCP clients                                                     |
| Revoked agent still accepted briefly | Caches or clock skew                                      | Revoke in Settings; disconnect client; wait one token lifetime                                                                        |

## Security boundaries

- **Staff** may face extra gates (Terms first, restricted routes).
- **Tokens** stay narrow: personal agent tokens include only requested services and expiry; reissue does not broaden historical grants.
- **Revocation** terminates future calls; clients must drop stored bearer material.
- **Logs** aid audits but are not a substitute for reading token claims inside your own services.

## Related pages

- [Authentication](/features/authentication) - token exchange, regional servers, session storage
- [Security](/features/security) - token storage, BFF, CSP
- [Backend](/backend) - `backend.url` and identity configuration
- [Local dev stack](/dev-stack) - compose, ports, `./start.sh`, JWT key generation
- [CLI](/cli) - `shellui login`, config split, deploy token env vars
