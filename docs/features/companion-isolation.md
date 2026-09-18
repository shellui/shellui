---
title: Companion origin isolation
sidebar_label: Companion isolation
description: 'Iframe sandbox, distinct-origin dev companions, and production same-origin plan (Track F / M-18).'
---

Shellui embeds companion microfrontends in a sandboxed iframe (`ContentView`). This page documents the **M-18** threat model and the incremental isolation plan from the 2026-09-17 security review.

## Current architecture

| Mode                       | Shell origin                      | Companion origin                              | Isolation mechanism                                                       |
| -------------------------- | --------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| **Dev** (`shellui start`)  | `http://localhost:4000` (typical) | `http://localhost:5173`, `:3000`, `:4200`, …  | **Distinct origins** + companion `frame-ancestors` CSP allowing the shell |
| **Prod** (`shellui build`) | Your deploy origin                | Same origin under `/app/` (relative nav URLs) | Same-origin companion path; no cross-origin framing                       |

Generated starters wire `dev.url` to a loopback companion port and set `frame-ancestors` on Next.js / Nuxt so the shell can frame the dev server safely.

## Iframe sandbox (incremental tightening)

The content iframe uses:

```text
allow-same-origin allow-scripts allow-forms allow-popups
```

**Removed in Track F:** `allow-popups-to-escape-sandbox` — popups from companion content stay sandboxed.

### Residual: `allow-same-origin` + `allow-scripts`

When the iframe document is same-origin to its configured URL, scripts can remove the sandbox attribute. This combination is **required today** so companions can use cookies, `localStorage`, and SDK postMessage on their origin during dev.

**Mitigations:**

1. **Distinct origins in dev** — shell and companion run on different ports; navigation `url` origin checks prevent the iframe from drifting to an unexpected origin.
2. **Trusted navigation URLs** — only load companions you configure in `navigation[].url` / init templates.
3. **Production same-origin** — serve built companions from `/app/` on the shell origin so framing stays first-party.

### Future work (documented, not in scope for #65)

- Tighter sandbox when shell and iframe origins match in production (evaluate dropping `allow-same-origin` once all SDK paths work with opaque-origin companions).
- Optional `navigation` origin allowlist in config schema.

Implementation: `packages/core/src/components/contentIframeSandbox.ts` (resolved in `ContentView`).

## Related CLI hardening (Track F)

Companion URL validation for `dev.url` / `--follow` lives in the CLI ([CLI reference — companion process](/cli#companion-process)). Loopback login nonce binding is documented under [CLI login](/cli#shellui-login-root).
