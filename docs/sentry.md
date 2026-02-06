# Sentry Error Reporting

ShellUI can report runtime errors to [Sentry](https://sentry.io) in production so you can track and fix bugs from real usage.

## Behavior

- **Production only**: Sentry is initialized only when the app is built and run in production. In development (`shellui start` / dev mode), Sentry is **never** initialized, so local errors are not sent and you avoid noise in your Sentry project.
- **Env-only, merged on load**: You do **not** add Sentry to `shellui.config.ts`. The CLI merges Sentry into the config when it loads it, using environment variables. Enable or disable via env only.

## Configuration

### 1. Environment variables

Sentry is **merged on load** by the CLI: when you run `shellui build` or `shellui start`, the loaded config is augmented with `sentry` from env. No Sentry code in `shellui.config.ts` is required.

| Environment variable | Required        | Description                                                                                                                                                                |
| -------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SENTRY_DSN`         | Yes (to enable) | Your Sentry project DSN (Data Source Name). Find it in Sentry: Project → Settings → Client Keys (DSN). When set, Sentry is enabled (unless disabled via `SENTRY_ENABLED`). |
| `SENTRY_ENABLED`     | No              | Set to `false` or `0` to disable Sentry even when `SENTRY_DSN` is set. Omit or set to any other value to allow Sentry when DSN is set.                                     |
| `SENTRY_ENVIRONMENT` | No              | Environment name (e.g. `production`, `staging`). Defaults to `production` if not set.                                                                                      |
| `SENTRY_RELEASE`     | No              | Release identifier (e.g. git SHA or app version). Useful for release-based grouping in Sentry.                                                                             |

At build time the CLI injects these as three separate globals (one string each), not as part of the stringified app config: `__SHELLUI_SENTRY_DSN__`, `__SHELLUI_SENTRY_ENVIRONMENT__`, and `__SHELLUI_SENTRY_RELEASE__`. The core reads them individually when initializing Sentry.

### 2. Set environment variables

**Local / manual builds**

- Create a `.env` file in the project root (do not commit it; it is in `.gitignore`).
- Add:

  ```env
  SENTRY_DSN=https://your-key@your-org.ingest.sentry.io/project-id
  SENTRY_ENVIRONMENT=production
  SENTRY_RELEASE=1.0.0
  ```

  To disable Sentry even when `SENTRY_DSN` is set (e.g. for a staging build without reporting): set `SENTRY_ENABLED=false` or `SENTRY_ENABLED=0`.

- Ensure your build process loads `.env` before running the ShellUI build (e.g. if you use `dotenv` or a tool that injects env, run it before `shellui build`).

**GitHub Actions (or other CI/CD)**

- In your workflow, set the same variables as **secrets** or **env** so they are available when the build runs.
- Example:

  ```yaml
  env:
    SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
    SENTRY_ENVIRONMENT: production
    SENTRY_RELEASE: ${{ github.sha }}
  ```

- Add `SENTRY_DSN` in the repo/organization secrets (Sentry → Project → Settings → Client Keys (DSN)).

### 3. Get your DSN

1. Sign in at [sentry.io](https://sentry.io).
2. Create or select a project (e.g. React / JavaScript).
3. Go to **Settings → Client Keys (DSN)** and copy the DSN.
4. Use this value for `SENTRY_DSN` in `.env` or CI secrets.

## How it is used

- **When Sentry runs**: Only in production builds. The app checks `import.meta.env.DEV`; when it is `false` and the Sentry DSN is set, the ShellUI core initializes `@sentry/react`. At build time the CLI injects three separate globals (one string each): `__SHELLUI_SENTRY_DSN__`, `__SHELLUI_SENTRY_ENVIRONMENT__`, and `__SHELLUI_SENTRY_RELEASE__`. The core reads these individually and does not use the main stringified config for Sentry.
- **What gets reported**: Uncaught JavaScript errors and unhandled promise rejections are sent to Sentry automatically.
- **When Sentry is disabled**: In dev mode, when `SENTRY_DSN` is not set, or when `SENTRY_ENABLED` is `false` or `0`, Sentry is not initialized and no data is sent.

## Summary

| Context                                         | Sentry initialized? | Notes                                   |
| ----------------------------------------------- | ------------------- | --------------------------------------- |
| `shellui start` (dev)                           | No                  | Ignored so you don’t get dev noise.     |
| Production build, `SENTRY_DSN` set              | Yes                 | Errors reported to your Sentry project. |
| Production build, `SENTRY_DSN` not set          | No                  | No reporting.                           |
| Production build, `SENTRY_ENABLED=false` or `0` | No                  | Disabled even if DSN is set.            |

Sentry is configured only via env: set `SENTRY_DSN` (and optionally `SENTRY_ENABLED`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`) in deployment or `.env`. Nothing is required in `shellui.config.ts`.
