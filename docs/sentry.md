---
title: Report errors with Sentry
sidebar_label: Sentry
description: Set SENTRY_DSN for production builds so the shell initializes @sentry/react. Dev start never sends events.
---

The shell can send uncaught JavaScript errors and unhandled promise rejections to [Sentry](https://sentry.io) in **production** builds. `shellui start` never initializes Sentry, so local errors do not hit your project.

You do not have to put Sentry in `shellui.config.json`. The CLI merges `sentry` from environment variables when it loads config. You may still write `"dsn": "${SENTRY_DSN}"` and use [env substitution](/cli#environment-variable-substitution); the dedicated merge still applies when `SENTRY_DSN` is set.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `SENTRY_DSN` | yes to enable | Project DSN (Sentry → Project → Settings → Client Keys). Enables Sentry unless disabled below |
| `SENTRY_ENABLED` | no | `false` or `0` disables even when DSN is set |
| `SENTRY_ENVIRONMENT` | no | Shown in Sentry. Defaults to `production` if unset |
| `SENTRY_RELEASE` | no | Release id (git SHA or app version) for grouping |

At build time the CLI injects the full config (including `sentry`) via `@shellui/config`. Core reads that module when `import.meta.env.DEV` is false and a DSN is present, then initializes `@sentry/react`.

Local `.env` (gitignored):

```env
SENTRY_DSN=https://your_key@your_org.ingest.sentry.io/project_id
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=1.0.0
```

The CLI loads dotenv. CI example:

```yaml
env:
  SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
  SENTRY_ENVIRONMENT: production
  SENTRY_RELEASE: ${{ github.sha }}
```

A DSN in the frontend bundle is expected for browser Sentry. It is not a secret with write access to your infra.

## When Sentry runs

| Context | Initialized |
| --- | --- |
| `shellui start` (dev) | No |
| Production build, `SENTRY_DSN` set, `SENTRY_ENABLED` not `false`/`0` | Yes |
| Production build, no DSN | No |
| Production build, `SENTRY_ENABLED=false` or `0` | No |

If you also declare `sentry.io` in [cookie consent](/features/cookie-consent), gate extra client SDKs you initialize yourself. The shell's own production init still follows the table above.
