---
title: Companion origin isolation
sidebar_label: Companion isolation
description: 'Iframe sandbox, distinct-origin companions, and shell pages that stay on the shell origin.'
---

Shellui embeds companion micro frontends in a sandboxed iframe (`ContentView`). This page describes the threat model, what Shellui does today, and the risks that remain.

## Current architecture

| Mode                      | Shell origin                      | Companion origin                                 | Isolation mechanism                                                                                         |
| ------------------------- | --------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Dev** (`shellui start`) | `http://localhost:4000` (typical) | `http://localhost:5173`, `:3000`, `:4200`, …     | **Distinct origins**. Sandbox keeps `allow-same-origin` so the companion keeps its own cookies and storage. |
| **Prod, own origin**      | Your deploy origin                | Another origin, such as `https://app.example`    | Distinct origins. Sandbox keeps `allow-same-origin`.                                                        |
| **Prod, shell origin**    | Your deploy origin                | Same origin, including the build default `/app/` | Sandbox **omits** `allow-same-origin`. The frame gets an opaque origin. Shellui warns in the console.       |

Generated starters wire `dev.url` to a loopback companion port. The Next.js and Nuxt starters send this header:

```text
Content-Security-Policy: frame-ancestors 'self' http://localhost:4000 http://127.0.0.1:4000
```

Only the companion's own origin and a shell on port 4000 of `localhost` or `127.0.0.1` can frame it. If your shell runs on another port or a deployed origin, update this header. The other starters do not set `frame-ancestors`.

## Iframe sandbox

Cross-origin companions, including local dev, use:

```text
allow-same-origin allow-scripts allow-forms allow-popups
```

A companion URL on the shell origin uses:

```text
allow-scripts allow-forms allow-popups
```

Shell pages (settings, cookie preferences, login, and the other shell routes) stay on the shell origin and keep `allow-same-origin`.

Shellui does not grant `allow-popups-to-escape-sandbox`, so popups opened by companion content stay sandboxed.

`shellui build` still defaults `SHELLUI_APP_URL` to `/app` when it is unset. That path is on the shell origin, so the sandbox above omits `allow-same-origin`. Set `SHELLUI_APP_URL` to the companion's own absolute origin, and point navigation `url`, administration URLs, and `storage.filesUrl` at that origin, when the companion needs its own cookies, storage, or a concrete postMessage origin. The shell logs a console warning for each same-origin companion path.

Shellui sets the `sandbox` attribute only on the content iframe it renders. It does not set a sandbox on nested frames. Frames a companion creates inside its own page, including frames rendered with the SDK frame component, get only the attributes the companion passes.

Implementation: `packages/core/src/components/contentIframeSandbox.ts` (resolved in `ContentView`).

### Mitigations

1. **Distinct origins in dev.** Shell and companion run on different ports. Navigation `url` origin checks keep the iframe from drifting to an unexpected origin.
2. **Trusted navigation URLs.** Only load companions you configure in `navigation[].url` or init templates.

### Cross-origin companions

Dev companions and production companions on their own origin keep `allow-same-origin` so cookies, `localStorage`, and SDK postMessage stay on that origin. Distinct origins are the isolation layer. Navigation `url` checks keep the iframe on the origin you configured.

### Same-origin companion URL

A companion path on the shell origin, including `/app/`, does not receive the shell origin. The frame cannot read the shell's `localStorage` or `sessionStorage`, and its postMessage origin is opaque (`null`). The settings handshake and shell cookies do not work in that frame. Host the companion on its own origin instead.

Shell pages are not companions. Settings and the other shell routes keep `allow-same-origin`.

### Future work

- An optional `navigation` origin allowlist in the config schema.

## Related CLI hardening

Companion URL validation for `dev.url` and `--follow` lives in the CLI ([CLI reference: companion process](/cli#companion-process)). Loopback login nonce binding is documented under [CLI login](/cli#shellui-login-root).
