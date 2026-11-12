---
title: Companion origin isolation
sidebar_label: Companion isolation
description: 'Iframe sandbox, distinct-origin dev companions, and the residual risks of same-origin production.'
---

Shellui embeds companion micro frontends in a sandboxed iframe (`ContentView`). This page describes the threat model, what Shellui does today, and the risks that remain.

## Current architecture

| Mode                       | Shell origin                      | Companion origin                              | Isolation mechanism                                                       |
| -------------------------- | --------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| **Dev** (`shellui start`)  | `http://localhost:4000` (typical) | `http://localhost:5173`, `:3000`, `:4200`, …  | **Distinct origins** + companion `frame-ancestors` CSP allowing the shell |
| **Prod** (`shellui build`) | Your deploy origin                | Same origin under `/app/` (relative nav URLs) | Same-origin companion path; no isolation between shell and companion      |

Generated starters wire `dev.url` to a loopback companion port. The Next.js and Nuxt starters send this header:

```text
Content-Security-Policy: frame-ancestors 'self' http://localhost:4000 http://127.0.0.1:4000
```

Only the companion's own origin and a shell on port 4000 of `localhost` or `127.0.0.1` can frame it. If your shell runs on another port or a deployed origin, update this header. The other starters do not set `frame-ancestors`.

## Iframe sandbox

The content iframe uses:

```text
allow-same-origin allow-scripts allow-forms allow-popups
```

Shellui does not grant `allow-popups-to-escape-sandbox`, so popups opened by companion content stay sandboxed.

Shellui sets the `sandbox` attribute only on the content iframe it renders. It does not set a sandbox on nested frames. Frames a companion creates inside its own page, including frames rendered with the SDK frame component, get only the attributes the companion passes.

Implementation: `packages/core/src/components/contentIframeSandbox.ts` (resolved in `ContentView`).

### Mitigations

1. **Distinct origins in dev.** Shell and companion run on different ports. Navigation `url` origin checks keep the iframe from drifting to an unexpected origin.
2. **Trusted navigation URLs.** Only load companions you configure in `navigation[].url` or init templates.

### Residual risk: `allow-same-origin` + `allow-scripts`

When the iframe document is same-origin to its configured URL, scripts can remove the sandbox attribute. Companions need this combination today to use cookies, `localStorage`, and SDK postMessage on their origin during dev.

### Residual risk: same-origin production

Production companions load from `/app/` on the shell origin. Framing stays first-party, but the sandbox gives no isolation between shell and companion: the companion runs with the shell's origin. A script in that frame can read the shell's `sessionStorage`. Without the host routes, that includes the refresh token at `shellui.auth.refresh`. When the shell host keeps the refresh token in the HttpOnly `shellui_refresh` cookie, that key is empty, but a same-origin request to `/api/auth` still sends the cookie.

Serve companions on a different origin, including the desktop webview, so they cannot call the shell routes that use the cookie.

### Future work

- A tighter sandbox when shell and iframe origins match in production. Shellui will evaluate dropping `allow-same-origin` once all SDK paths work with opaque-origin companions.
- An optional `navigation` origin allowlist in the config schema.

## Related CLI hardening

Companion URL validation for `dev.url` and `--follow` lives in the CLI ([CLI reference: companion process](/cli#companion-process)). Loopback login nonce binding is documented under [CLI login](/cli#shellui-login-root).
