---
title: Security hardening
sidebar_label: Security
description: 'Split auth token storage, shell-host HttpOnly refresh cookie, and staged shell CSP.'
---

This guide covers hardening shipped in the shell:

1. **Reduced token persistence blast radius** when the page talks to identity itself
2. **Shell-host refresh cookie** so the refresh token stays out of page JavaScript
3. **Shell Content-Security-Policy** with an inline script hash (staged report-only by default)

Companion sandbox isolation ([#65](https://github.com/shellui/shellui/issues/65)) is out of scope here. For postMessage origin allowlists (`security.allowedMessageOrigins`), see the postMessage hardening notes in the changelog and [Authentication](/features/authentication).

## Token storage (no host routes)

Without `/api/auth` on the shell origin, the shell splits persisted auth state:

| Location         | Key                    | Contents                                       |
| ---------------- | ---------------------- | ---------------------------------------------- |
| `localStorage`   | `shellui.auth.profile` | User profile + expiry metadata (**no tokens**) |
| `sessionStorage` | `shellui.auth.refresh` | Refresh token (tab-scoped)                     |
| Memory (React)   | (none)                 | Access token only                              |

Legacy `shellui.auth.session` blobs are migrated automatically on first read.

This is what a static host does. `shellui start` and `serve:dist` serve the routes below unless you turn them off, and the page then uses the cookie instead of `sessionStorage`.

### Residual risk

- **Refresh tokens are JavaScript-readable** in this mode (`sessionStorage`). XSS in the shell can exfiltrate them. A same-origin companion under `/app/` can read that entry as well. See [Companion isolation](/features/companion-isolation).
- **Access tokens are not written to web storage**, but they still live in memory and may be forwarded to trusted iframe companions via `SHELLUI_SETTINGS` (see [Navigation → `safeForAuthToken`](/features/navigation)). The refresh token is not forwarded.
- **An app `backend` gets its own session.** The shell sends that server's access token to the app and does not send the shell token. Shell `email`, `storage`, and `hosting` URLs are not sent unless that item sets them. That other refresh token stays in `sessionStorage` under a separate key, including regional token exchange. Refresh tokens are still not sent to iframes. See [Apps on another identity server](/features/authentication#apps-on-another-identity-server).
- **New tabs** do not inherit `sessionStorage`. Without the host cookie, people sign in again.

## Shell-host refresh cookie

The refresh token is an HttpOnly cookie on the **shell** origin (`shellui_refresh`, path `/api/auth`, `SameSite=Lax`, `Secure` on HTTPS). Identity can stay on another site. The cookie is first-party, so Safari and Firefox do not treat it as a third-party cookie.

`shellui start` and `serve:dist` mount the routes when `backend.url` is set, unless you turn them off:

```json
{
  "security": {
    "bffAuth": {
      "enabled": false
    }
  }
}
```

Leave `enabled` out, or set it to `true`, on a host that implements the routes. The dev stack sets `true` in `dev/config/shellui.security.config.json`.

The page does not trust the flag alone. It sends one `GET /api/auth/session`. A JSON body `{"ready":true}` means the routes are there. HTML from a static file host, or a 404, means they are not, and the page keeps the sessionStorage refresh token. The probe result is cached for the page load. A missing route does not exchange the one-time code twice.

### Routes

| Route                    | Purpose                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `GET /api/auth/session`  | `{"ready":true}` when this host implements the routes. No cookie and no identity call.                     |
| `POST /api/auth/session` | Exchange `auth_code`, `redirect_to`, and `code_verifier` with identity. Set the cookie. Return no refresh. |
| `POST /api/auth/refresh` | Read the cookie, rotate it at identity, return a new access token and expiry.                              |
| `POST /api/auth/logout`  | Revoke the session at identity using the cookie, then clear the cookie.                                    |

`POST /api/auth/session` does not accept a refresh token from the page. The browser does not call `POST /api/v1/oauth/session` itself when these routes are in use.

The host calls identity server to server:

```
POST {backend.url}/api/v1/oauth/session
Origin: {shell origin}
Content-Type: application/json

{ "auth_code", "redirect_to", "code_verifier" }
```

`Origin` is the origin of `redirect_to` (the shell origin, for example `https://shell.example` from `https://shell.example/login/callback`). The host does not send cookies to identity on this call. Identity returns `access_token`, `refresh_token`, `token_type`, `expires_in`, and `expires_at`. An origin mismatch is HTTP 400 with no `error_code`. A PKCE failure is HTTP 400 with `error_code`, and identity does not consume the code. The shell shows that error and does not exchange the code again. Do not send the identity URL as `Origin`. `SHELLUI_BFF_BACKEND_URL` overrides `backend.url` for the server-side call only (the dev container uses `http://identity:8000` while the browser uses localhost).

The JSON returned to the page is `access_token`, `expires_in` or `expires_at`, `token_type`, and `user` (`id`, `email`, `name` from the access token). There is no `refresh_token`. The access token stays in memory. The shell still refreshes it 90 seconds before `expiresAt`. A new tab restores from `shellui.auth.profile` plus `POST /api/auth/refresh`. If the cookie is missing, that refresh is 401, the profile is cleared, and the login page is shown. It is not retried.

Logout from the page is `POST /api/auth/logout` with the access token as `Authorization`. The host adds the refresh token from the cookie when it calls `POST /api/v1/logout`, then clears the cookie. The page does not send a refresh token.

After the cookie is cleared, the tab that signed out still opens identity `logout_url` when `GET /api/v1/settings` includes it (`company_id` and `return_to`). That clears the identity browser session. Other tabs do not follow that navigation. See [Authentication](/features/authentication).

Cookie flags: `HttpOnly`, `SameSite=Lax`, `Path=/api/auth`, and `Secure` when the shell request is HTTPS (`X-Forwarded-Proto: https` or a TLS socket). `Max-Age` is the refresh token expiry identity returns (the refresh JWT `exp`, or `refresh_expires_in` / `refresh_expires_at` when present). When that expiry is missing, `Max-Age` is 7 days. `SHELLUI_BFF_SECURE_COOKIE=1` forces `Secure` on. `=0` forces it off. `http://localhost` omits `Secure` so the cookie is stored.

Every `POST` requires `Content-Type: application/json` and a same-origin request. `Origin` must be this host (`Host` or `X-Forwarded-Host`, plus the forwarded or TLS scheme). When `Origin` is absent, `Sec-Fetch-Site: same-origin` is accepted. Anything else is 403 and does not set a cookie. `redirect_to` on `POST /api/auth/session` must use that same origin. `OPTIONS` is a bare 204 with no CORS headers.

`security.bffAuth.cookieName` changes the cookie name (default `shellui_refresh`). Only the host reads it.

### Your own proxy

A production reverse proxy in front of a static shell can implement the same four routes. Keep them on the shell origin. Upstream identity is `backend.url` (or your own equivalent of `SHELLUI_BFF_BACKEND_URL`).

1. `GET /api/auth/session` returns `200` `Content-Type: application/json` and `{"ready":true}` with `Cache-Control: no-store`.
2. `POST /api/auth/session` reads JSON `auth_code`, `redirect_to`, and `code_verifier`. It POSTs that JSON to `{identity}/api/v1/oauth/session` with `Origin` set to the origin of `redirect_to`, and with no cookie. On success, identity returns `access_token`, `refresh_token`, `token_type`, `expires_in`, and `expires_at`. The proxy sets the cookie from `refresh_token` and responds with the access token, expiry, and user only.
3. `POST /api/auth/refresh` reads the cookie and POSTs `{ "refresh_token" }` to `{identity}/api/v1/token?grant_type=refresh_token`. `Origin` is not required. Identity rotates the refresh token. The proxy stores the new one in the cookie and returns the new access token and expiry.
4. `POST /api/auth/logout` POSTs `{identity}/api/v1/logout` with `Authorization: Bearer <access>` and JSON `{ "refresh_token" }` from the cookie, then sends `Set-Cookie` with `Max-Age=0`.

Reject a body that only contains `refresh_token`. Do not put `refresh_token` in any response body.

### What still reaches page JavaScript

- **Magic link** in the browser uses the same one-time `shellui_auth_code` as OAuth. With the host routes up, the refresh token stays on the host.
- **Password.** The shell login page has no password form, so it does not receive a refresh token.
- **URL fragment delivery** (`#access_token` and `#refresh_token`, identity `OAUTH_TOKEN_DELIVERY=fragment`) puts the refresh token in the page. The shell stores it in `sessionStorage` and refreshes it with identity directly. It does not post that token to the host.
- **Legacy provider `?code=`** (`POST /api/v1/oauth/exchange`) still returns tokens to the page.
- **`shellui login` in the browser** forwards the refresh token to the CLI on a loopback URL. That exchange stays on the page so the CLI receives both tokens. It does not use the host cookie.
- **Supabase** sign-in still returns the refresh token to the page. The host code exchange is for `backend.type` `shellui` only.
- **Per-app and regional sessions** keep their own refresh token in `sessionStorage`. Signing out of the shell still clears them.

### Sign-in does not loop

The probe runs once. If it fails, the page uses the direct exchange and does not probe again. If the host returns HTML or 404 for the code exchange, the page exchanges that code with identity once. An error from identity (the code was used, or access is pending) is shown and is not exchanged again. A refresh 401 clears the stored profile and shows login. It does not start another code exchange.

## Shell CSP

CSP headers are emitted by:

- `shellui start` (dev)
- `pnpm run serve:dist` (production preview)

Default policy characteristics:

- Inline theme bootstrap allowed via **SHA-256 hash** (see `packages/cli/src/utils/csp.js`, kept in sync with `index.html`)
- `script-src 'self' 'sha256-…'`
- Permissive `frame-src` for localhost companions during rollout
- `connect-src` includes `backend.url` when configured

### Staged rollout

By default the shell sends **`Content-Security-Policy-Report-Only`** so playgrounds keep working while you collect violations.

```json
{
  "security": {
    "csp": {
      "reportOnly": true,
      "reportUri": "https://reports.example.com/csp"
    }
  }
}
```

When clean, switch to enforcing:

```json
{
  "security": {
    "csp": {
      "enforce": true,
      "reportOnly": false
    }
  }
}
```

Add companion origins explicitly if needed:

```json
{
  "security": {
    "csp": {
      "connectSrc": ["http://localhost:5173"],
      "frameSrc": ["http://localhost:3000"]
    }
  }
}
```

If you serve `dist/web/` from a CDN without Shellui middleware, replicate the same header (hash from `computeThemeInitScriptHash()` in `@shellui/cli` utils or your build pipeline).

## Verification checklist

1. Sign in. Confirm `localStorage` has `shellui.auth.profile` **without** token fields.
2. With no host routes (`security.bffAuth.enabled` false, or a static host): the refresh token is only under `sessionStorage` key `shellui.auth.refresh`.
3. With `shellui start` or `serve:dist`: after a one-time code sign-in, the refresh token is not in web storage. `POST /api/auth/refresh` returns a new access token. `GET /api/auth/session` returns `{"ready":true}`.
4. DevTools → Network: HTML responses include `Content-Security-Policy-Report-Only` (unless enforcing).
5. Run unit tests: `pnpm test` (core auth persistence + CLI CSP helpers).

## Related docs

- [Authentication](/features/authentication)
- [Connect a backend](/backend)
- [AI native platform](/features/ai-native)
