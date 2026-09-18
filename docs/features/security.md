---
title: Security hardening
sidebar_label: Security
description: 'Split auth token storage, optional BFF with HttpOnly refresh cookies, and staged shell CSP.'
---

This guide covers **H-09 / M-17** hardening shipped incrementally in the shell:

1. **Reduced token persistence blast radius** (default, no config required)
2. **Optional same-origin BFF** for HttpOnly refresh cookies
3. **Shell Content-Security-Policy** with inline script hash (staged report-only by default)

Companion sandbox isolation ([#65](https://github.com/shellui/shellui/issues/65)) is out of scope here. For postMessage origin allowlists (`security.allowedMessageOrigins`), see the postMessage hardening notes in the changelog and [Authentication](/features/authentication).

## Token storage (default)

Without any `security` config, the shell now splits persisted auth state:

| Location         | Key                    | Contents                                       |
| ---------------- | ---------------------- | ---------------------------------------------- |
| `localStorage`   | `shellui.auth.profile` | User profile + expiry metadata (**no tokens**) |
| `sessionStorage` | `shellui.auth.refresh` | Refresh token (tab-scoped)                     |
| Memory (React)   | —                      | Access token only                              |

Legacy `shellui.auth.session` blobs are migrated automatically on first read.

### Residual risk (default mode)

- **Refresh tokens remain JavaScript-readable** inside the tab (`sessionStorage`). XSS in the shell can still exfiltrate them until you enable BFF.
- **Access tokens are not written to web storage**, but they still live in memory and may be forwarded to trusted iframe companions via `SHELLUI_SETTINGS` (see [Navigation → `safeForAuthToken`](/features/navigation)).
- **New tabs** do not inherit `sessionStorage`; users may need to sign in again unless BFF HttpOnly cookies are enabled.

## BFF auth (HttpOnly refresh) — phased

Enable when the shell is served from an origin that can host `/api/auth/*` (CLI dev server, `serve:dist`, or your production reverse proxy):

```json
{
  "backend": {
    "type": "shellui",
    "url": "http://localhost:8000",
    "companyId": 1
  },
  "security": {
    "bffAuth": {
      "enabled": true
    }
  }
}
```

### What works today

| Route                    | Purpose                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `POST /api/auth/session` | Accept refresh once after OAuth/hash login; sets **HttpOnly** `shellui_refresh` cookie |
| `POST /api/auth/refresh` | Rotate access token server-side; refresh never returned to JS                          |
| `POST /api/auth/logout`  | Clears cookie (+ identity logout when possible)                                        |

The CLI wires these in `shellui start` and `pnpm run serve:dist`.

### Production follow-ups (not in this repo)

- **Identity-service cookie endpoints** — today the BFF proxies existing `/api/v1/token` refresh. A native cookie session API on identity would remove the one-time JS hand-off on login.
- **OAuth callback without hash tokens** — ideal flow: identity sets cookie → redirects shell without `#access_token=…`. Requires identity/hosting changes.
- **CDN / edge** — replicate `/api/auth/*` on your edge if the static shell and API share a public origin.
- **`Secure` cookies** — set `SHELLUI_BFF_SECURE_COOKIE=1` (or serve over HTTPS) in production.

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

1. Sign in — confirm `localStorage` has `shellui.auth.profile` **without** token fields.
2. With default mode — refresh token appears under `sessionStorage` key `shellui.auth.refresh` only.
3. Enable `security.bffAuth.enabled` — after login, refresh token should **not** appear in web storage; `/api/auth/refresh` returns a new access token.
4. DevTools → Network — HTML responses include `Content-Security-Policy-Report-Only` (unless enforcing).
5. Run unit tests: `pnpm test` (core auth persistence + CLI CSP helpers).

## Related docs

- [Authentication](/features/authentication)
- [Connect a backend](/backend)
