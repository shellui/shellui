---
title: AI native local MCP testing
sidebar_label: AI native platform
description: Local compose path for MCP OAuth, gateway tools, and approvals.
---

Run **Shellui** `shellui/dev` next to the sibling service repos, then drive
regional MCP with curl and a browser. Identity owns OAuth. The ai gateway owns
`tools/list`, approvals, and `session_allow`. Use
[AI native MCP](./ai-native-mcp) for short connector URL pointers.
Links use the `develop` branch.

## What this repo validates vs what you run locally

**What this repo validates:**

- `pnpm run test:scripts` runs `python3 tools/test_generate_env.py`.
- When `docker` is installed, that script writes a temp env file and runs:

```bash
docker compose -f dev/docker-compose.yml \
  --env-file <temp> config --format json
```

It checks resolved `environment` on `identity`, `ai`, and `saas`:
`JWT_ISSUER`, `GLOBAL_ISSUER_URL` (SaaS origin),
`GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`, `AI_SERVICE_ISSUER`,
`AI_SERVICE_JWKS_URL`, identity `IDENTITY_SERVICE_URL` and
`IDENTITY_JWKS_URL` (`http://identity:8000`), saas
`IDENTITY_INTERNAL_URL`, and a `kid` inside `GLOBAL_JWKS`. That is
compose JSON. It does not send HTTP to the containers.

- `node scripts/verify-ai-native-doc.mjs`
- `pnpm run docs:build`

If `docker` is missing, the script prints `docker not available; skipped
compose config validation` and `pnpm run test:scripts` still passes. Issuer
checks did not run on that host.

**Live on your machine:** with `shellui/dev` up, you run the regional OAuth
steps below, `tools/list` on `http://localhost:8006/c/1/mcp`, human
`GET /api/v1/mcp/approvals`, and
`POST /api/v1/mcp/approvals/{id}/decide`. Activity is rendered by
`McpAgentActivitySection.tsx`. SaaS MCP is `POST http://localhost:8005/mcp`.
Mint, exchange, gateway approval, and a downstream call are separate manual
steps. This repo's pytest does not run that chain. Identity pytest covers
exchange with fixtures. That is not this compose stack.

## Global vs regional (no master token)

- **Global MCP** is `POST http://localhost:8005/mcp`. Identity
  `list_services` builds that URL from `SAAS_SERVICE_URL` plus `/mcp`.
  It does not read regional identity, storage, hosting, or email data.
- **Regional gateway** is `POST http://localhost:8006/c/1/mcp` for the
  seeded company. `POST http://localhost:8006/mcp` returns 404
  `company_required`.
- A regional access token `aud` is that per-company URL. The global agent
  JWT `aud` is `GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`
  (`shellui_global_agent_dev` in `dev/.env.local.example`), not
  `http://localhost:8005/mcp`. There is no master token.
- Regional calls use a short-lived token from RFC 8693 exchange. Do not
  send the global JWT to a regional `/mcp`, and do not mint a stand-in
  with Django admin.
- `GET /api/v1/mcp/approvals` and decide routes need a human company
  token, not an agent Bearer token.
- `GET /oauth/authorize` on the SaaS origin is user OpenID (`scope`
  `openid email profile`). It is not the agent token endpoint.

## Install and start (Shellui `develop`)

Clone the repos side by side and start `shellui/dev`. See [dev-stack]. Then:

```bash
cd shellui/dev
./start.sh
```

`start.sh` runs `generate-env.sh`, then
`docker compose --env-file .env.local up --build`.
Identity publishes `- '8001:8000'`.
Hosting publishes `8003:8000`.

Set `SHELLUI_INSTANCE_ROLE=region`, `GLOBAL_ISSUER_URL`, `GLOBAL_JWKS`,
and `GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE`, or regional token exchange
returns 404.

`dev/generate_env.py` derives `GLOBAL_JWKS` and `GLOBAL_AGENT_KEY_ID`
from the same `GLOBAL_AGENT_SIGNING_KEY` PEM on every run.
`GLOBAL_AGENT_KEY_ID` is the `kid` in that JWKS.
`dev/docker-compose.yml` passes the PEM, the key id, and the audience
into `saas`. If you replace the PEM by hand, rerun `generate-env.sh`.

## Human account and Terms before agent work

`seed_dev` creates company **1** and a non-staff member `dev@localhost`.
Request a magic link in the shell at `http://localhost:4000`, then open
it from Mailpit at `http://localhost:8025`.

Accept Terms of Service on that human account before any agent step:
register, authorize, token exchange, or `tools/call`. Staff accounts
cannot authorize MCP clients. Sign in with `dev@localhost`.

Company id **1** is the seeded id (`SHELL_IDENTITY_COMPANY_ID`). The
resource path below uses `/c/1/mcp`. If your membership is a different
company, put that integer in the path.

## Official MCP clients

ai-service `./tools/mcp-e2e/run.sh` starts identity, ai-service, Postgres,
Redis, and a saas-mock. It runs the TypeScript MCP SDK, the Python `mcp`
SDK, and `@modelcontextprotocol/inspector --cli` through registration,
PKCE S256, `POST /oauth/mcp/token`, `initialize`, `tools/list`, and one
harmless `tools/call`. That job clears storage, hosting, and email URLs.
It is not `shellui/dev`. Shellui does not add a second Inspector script
on the full stack. See [ai-e2e].

## Regional curl

Use one loopback redirect in register, authorize, and token:
`http://127.0.0.1:8765/callback`. Identity compares it to the registered
list exactly. Start the listener before you open the authorize URL. It
binds `127.0.0.1` port 8765, reads `code` from the query, and writes
`/tmp/shellui-mcp-code`. Keep the same shell for the later blocks, or
read those files.

### Callback listener

```bash
rm -f /tmp/shellui-mcp-code
python3 - <<'PY' &
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse
class H(BaseHTTPRequestHandler):
    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        code = (q.get("code") or [""])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        if not code:
            self.wfile.write(b"no code\n")
            return
        open("/tmp/shellui-mcp-code", "w").write(code)
        self.wfile.write(b"code saved\n")
        self.server.stop = True
    def log_message(self, *a):
        return
s = HTTPServer(("127.0.0.1", 8765), H)
s.stop = False
while not s.stop:
    s.handle_request()
PY
```

### Register and save `client_id`

`POST /oauth/mcp/register` returns 201 and `client_id`. The next block
stores that id for the authorize URL and the token request.

```bash
python3 - <<'PY'
import json, urllib.request
body = json.dumps({
    "client_name": "local_dev_agent",
    "redirect_uris": ["http://127.0.0.1:8765/callback"],
}).encode()
req = urllib.request.Request(
    "http://localhost:8001/oauth/mcp/register",
    data=body,
    headers={"Content-Type": "application/json"},
)
with urllib.request.urlopen(req) as res:
    cid = json.load(res)["client_id"]
open("/tmp/shellui-mcp-client", "w").write(cid)
print(cid)
PY
```

### PKCE and authorize URL

`GET /oauth/mcp/authorize` reads `response_type`, `client_id`,
`redirect_uri`, `resource`, `code_challenge`, and
`code_challenge_method` (`S256`). It does not read `scope` or `services`.
A repeated query key keeps the first value only. `saas_offered=1` is the
extra query ai-service adds when `SAAS_SERVICE_URL` is set. It does not
grant SaaS by itself. `urllib.parse.urlencode` percent-encodes the query.
Identity decodes it and matches `redirect_uri` to the registered string.

```bash
python3 - <<'PY'
import base64, hashlib, secrets
import urllib.parse as u
cid = open("/tmp/shellui-mcp-client").read().strip()
v = secrets.token_urlsafe(48)
raw = hashlib.sha256(v.encode()).digest()
c = base64.urlsafe_b64encode(raw).decode().rstrip("=")
open("/tmp/shellui-mcp-verifier", "w").write(v)
q = [
    ("response_type", "code"),
    ("client_id", cid),
    ("redirect_uri", "http://127.0.0.1:8765/callback"),
    ("resource", "http://localhost:8006/c/1/mcp"),
    ("code_challenge", c),
    ("code_challenge_method", "S256"),
    ("state", "local_dev"),
    ("saas_offered", "1"),
]
print("http://localhost:8001/oauth/mcp/authorize?" + u.urlencode(q))
PY
```

Open that URL as `dev@localhost`. If identity shows its sign-in page,
finish the Mailpit link in this browser, then return to the same URL.
On consent, check the services you want. Identity pre-checks identity
and adds `ai` because the resource is the gateway. Those boxes are POST
fields named `services`, not authorize query parameters. `include_saas`
is a separate checkbox, shown only when `saas_offered=1` is set. Its
label is "Also allow SaaS tools (global Shellui account sign-in
required)". Leave `include_saas` unchecked until Terms are accepted.
Click **Allow**. The listener stores `code`.

### Token

Authorization-server metadata lists `token_endpoint` as
`POST /oauth/token`. `POST /oauth/mcp/token` is the same handler.
Send form fields, not JSON, so repeated keys survive. This block uses
the saved client id, the captured code, and the PKCE verifier.

```bash
CODE=$(cat /tmp/shellui-mcp-code)
CID=$(cat /tmp/shellui-mcp-client)
V=$(cat /tmp/shellui-mcp-verifier)
curl -sS -X POST "http://localhost:8001/oauth/mcp/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=authorization_code" \
  --data-urlencode "client_id=${CID}" \
  --data-urlencode "code=${CODE}" \
  --data-urlencode "redirect_uri=http://127.0.0.1:8765/callback" \
  --data-urlencode "code_verifier=${V}" \
  --data-urlencode "resource=http://localhost:8006/c/1/mcp" \
  -o /tmp/shellui-mcp-token.json
python3 - <<'PY'
import json
tok = json.load(open("/tmp/shellui-mcp-token.json"))
open("/tmp/shellui-mcp-access", "w").write(tok["access_token"])
print("access_token bytes", len(tok["access_token"]))
PY
```

### Gateway `tools/list`

```bash
TOK=$(cat /tmp/shellui-mcp-access)
curl -sS -X POST "http://localhost:8006/c/1/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOK}" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Names use a service prefix, for example `storage_list_bucket`. Object
list takes path parameter `bucket_id` on
`storage/v1/object/list/<bucket_id>` and a body from
`ObjectListRequestSerializer`. The gateway name is
`storage_create_object_list`.

## Downstream mint

The gateway calls
`POST /api/v1/mcp/internal/mcp-downstream-access-token` on identity
with an ai-service RS256 assertion when it calls another service
`/mcp`. The minted token `aud` is that resource URL. It is short-lived
and per company. It is not the global agent JWT.

## Approvals

- **List:** `GET /api/v1/mcp/approvals` with a human company token.
  Pending rows include `service`, `action`, `tool_name`, `target`,
  `is_destructive`, `short_action_summary`, and `arguments_redacted`
  (always `{}` for internal creates).
- **Decide:** `POST /api/v1/mcp/approvals/{id}/decide` with
  `{"decision":"approve"}` or `"deny"`.
- **Session:** in-chat `allow_session` (`session_allow` in chat
  metadata) applies to non-destructive tools. Default TTL is 60s
  (`MCP_APPROVAL_SESSION_TTL_SECONDS`, clamped 30 to 60).
- **Destructive:** `session_allow` does not apply. `mcp_access` `ask`
  still asks on destructive tools when `full` would allow other writes.
  New consent cannot enable destructive access without asking.
  `allow_destructive_without_asking` can remain on old `Agent` rows.
- Delegated agents (`global_agent_id` set) must take approvals from
  ai-service. Storage, hosting, and email get 409 `out_of_sync` if they
  create those approvals.

## Call logs

`POST /api/v1/mcp/internal/mcp-call-logs` requires `outcome` in
`allowed`, `failed`, `denied`, `waiting_approval`, or `session_used`.
`grant_version` is required (JSON integer) and must match the Agent.

Delegated agents must also send `global_company_id` (uuid string) and
`company_binding_version` (JSON integer). That pair plus `grant_version`
is the authority triple. All three must match the row. A mismatch
returns 409. Personal agents omit the binding fields. Session check
uses the same live triple when the agent is delegated.

`method` must be `POST` and `path` must be `/mcp`.

Identity stores the label as `POST /mcp` with the service id. Another
method or path returns 400.

Omit `arguments`, `arguments_redacted`, `operation_title`, and
`resource_label`.

Revoke with `POST /api/v1/mcp/agents/{id}/revoke`. Poll
`GET /api/v1/mcp/internal/mcp-revocations` as in [identity-mcp].

## Global token exchange (manual)

Finish the human account and Terms first. Complete global MCP OAuth on
saas-service using the authorization and token routes in its `develop`
handbook [saas-dev]. This page does not fold that consent into one
command, and it does not mint the subject token from Django admin.

When you have that global agent JWT, exchange it on identity. Repeated
`services` keys belong on this form body. They narrow the global agent.
They are not authorize query parameters. The subject `scope` is one
space-separated string and must include `ai`. `POST /oauth/token` and
`POST /oauth/mcp/token` share the handler. Human vault federation still
uses `handle_token_exchange` on `POST /oauth/token`, not this grant.

```bash
G=urn:ietf:params:oauth:grant-type:token-exchange
A=urn:ietf:params:oauth:token-type:access_token
curl -sS -X POST "http://localhost:8001/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "grant_type=${G}" \
  --data-urlencode "subject_token=${SUBJECT_TOKEN}" \
  --data-urlencode "subject_token_type=${A}" \
  --data-urlencode "requested_token_type=${A}" \
  --data-urlencode "company_id=1" \
  --data-urlencode "resource=http://localhost:8006/c/1/mcp" \
  --data-urlencode "access_mode=read_only" \
  --data-urlencode "read_level=safe" \
  --data-urlencode "allow_destructive=false" \
  --data-urlencode "services=identity" \
  --data-urlencode "services=storage"
```

Set `SUBJECT_TOKEN` to the global agent access JWT before you run it.
The response is a regional token for company 1. This repo has not run
mint, this exchange, a gateway approval, and a downstream call together.
`pnpm run test:scripts` does not perform that HTTP sequence.

Local compose sets `DEV_REGION_CODE` to `ch`. Tool names for SaaS company
create and retrieve stay in the saas-service handbook.

## `shellui.config.json` (human CLI)

```json
{
  "backend": {
    "type": "shellui",
    "url": "http://localhost:8001",
    "companyId": "1"
  },
  "saas": { "url": "http://localhost:8005" }
}
```

`REGION_CH_IDENTITY_ORIGIN` labels the dashboard region row. `saas.url`
is the base for `GET /api/v1/companies/`.

## Shellui CLI routes (human session)

After `shellui login` (the token is not printed):

- `shellui projects list`: `GET {saas.url}/api/v1/companies/`
- `shellui projects get <uuid>`:
  `GET {saas.url}/api/v1/companies/{uuid}/`
- `shellui projects regions`: `GET {saas.url}/api/v1/regions/`
- `shellui projects endpoints <uuid>`:
  `GET {saas.url}/api/v1/companies/{uuid}/endpoints/`
- `shellui projects use <uuid>`: stores the default UUID
- `shellui projects create`: not implemented (`projects create`)

## Not a one-command flow here

- Inspector against `shellui/dev` with scripted OAuth is not in this
  repo. Use [ai-e2e] or the curl above.
- Global OAuth consent, then exchange, then approval, then a downstream
  `tools/call` is manual. Shellui pytest does not execute it.

## Reference links

[dev-stack]: https://github.com/shellui/shellui/blob/develop/docs/dev-stack.md
[identity-mcp]: https://github.com/shellui/identity-service/blob/develop/docs/mcp-and-agents.md
[mcp-views]: https://github.com/shellui/identity-service/blob/develop/apps/agents/oauth_views.py
[ai-mcp]: https://github.com/shellui/ai-service/blob/develop/docs/mcp.md
[ai-e2e]: https://github.com/shellui/ai-service/blob/develop/docs/mcp-e2e-conformance.md
[storage-serializer]: https://github.com/shellui/storage-service/blob/develop/apps/storage/serializers.py
[saas-dev]: https://github.com/shellui/saas-service/blob/develop/docs/dev-stack.md
[activity-tsx]: https://github.com/shellui/shellui/blob/develop/packages/core/src/features/settings/components/McpAgentActivitySection.tsx
