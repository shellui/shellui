---
title: CLI reference
sidebar_label: CLI
description: 'shellui commands, config files, environment substitution, tooling isolation, and preview deploy.'
---

The `@shellui/cli` binary is `shellui`. Install it from the [installation page](/installation). This page is the command and config reference. For a first project, use [Create a project](/quickstart).

## Commands

### shellui init

Create a project with the wizard or with flags.

```bash
shellui init
shellui init react
shellui init vue
shellui init angular
shellui init next
shellui init nuxt
shellui init svelte
shellui init alpine
shellui init empty
```

Non-interactive:

```bash
shellui init --framework react --backend shellui --company-id 123
shellui init --framework vue --backend supabase --supabase-url https://your_project.supabase.co
shellui init --framework empty --backend none
shellui init react ./my-project
shellui init --force
```

Without flags, the wizard asks for framework and backend. JS starters are fetched from the GitHub tag that matches the CLI version (not bundled in the npm tarball). They wire `@shellui/sdk/tiny` for theme and language, plus `dev.run` / `dev.url` so `shellui start` launches the companion. Empty stays shell-only (`Home` at `/`, no `dev` block). After a JS scaffold, init detects the package manager and runs install unless `--no-install`.

| Framework                        | Default `dev.run` | `dev.url`               |
| -------------------------------- | ----------------- | ----------------------- |
| React / Vue / SvelteKit / Alpine | `{pm} run dev`    | `http://localhost:5173` |
| Angular                          | `{pm} run dev`    | `http://localhost:4200` |
| Next.js / Nuxt                   | `{pm} run dev`    | `http://localhost:3000` |

The shell stays on port **4000** in generated config. Next.js and Nuxt companions pin port 3000. Nuxt 4 expects a recent Node 22.x / 24.x. Per-framework theme / i18n wiring, icons, and run notes: [Framework starters](/framework-starters).

**Options:** positional `framework` or `--framework`; `--backend none|shellui|supabase`; `--company-id`; `--supabase-url`; `--force`; `--no-install`; `--config`.

### shellui config migrate [root]

Evaluate `shellui.config.ts` the same way `start` / `build` do, write `shellui.config.json` with `$schema`, and rename the TypeScript file to `shellui.config.ts.bak`. Runtime values (`process.env`, `readFileSync`, computed fields) become plain JSON. The result is schema-validated. Review env-dependent values, then optionally `shellui config split`.

### shellui config split / unsplit [root]

Split one `shellui.config.json` into section files such as `shellui.root.config.json`, `shellui.navigation.config.json`, `shellui.backend.config.json`, `shellui.dev.config.json`, and other present top-level keys. After a successful split, `shellui.config.json` is removed - single-file and split modes cannot coexist.

`unsplit` merges `shellui.*.config.json` back, validates, and deletes the split files. Duplicate top-level keys across files are rejected.

### shellui start [root] / shellui dev [root]

Start the development server. `dev` is an alias for `start`.

```bash
shellui start
shellui start ./my-project
shellui start --host
shellui start --app
shellui start --run vite --follow http://localhost:5173
shellui start --shell-only
shellui start --follow https://staging.example.com --allow-remote-companion
```

Starts Vite with HMR for `@shellui/core`, opens the browser on first start, watches config, and uses `port` from config (default **3000** if unset). Does not load the project's Vite / PostCSS / TypeScript / Tailwind files - see [Tooling isolation](#tooling-isolation). `--app` starts the [desktop wrapper](/tauri).

**Options:** `[root]`; `--host` (`0.0.0.0`); `--app`; `--target web|tauri` (default `web`; `tauri` with `--app`); `--config` / `SHELLUI_CONFIG`; `--run`; `--follow`; `--allow-remote-companion`; `--shell-only`. Do not pass `--no-run` - cac treats that as a negation of `--run <command>` and breaks plain `shellui start`.

### Companion process

CLI-only. Never sent to the browser. `shellui build` ignores it.

```json
{
  "dev": {
    "run": "vite",
    "url": "http://localhost:5173",
    "name": "app"
  }
}
```

- **Spawn** (`run` set): `shellui start` is the parent. If `url` is set, the CLI waits for it before listening. Child **exit** (not a brief port blip) shuts down the shell.
- **Follow** (`url` only): start the shell as usual. After the URL has been healthy once, if it stays down (~2s), the CLI exits. A URL that never comes up does not kill the shell.
- **URL validation (Track F / L-14):** `dev.url` and `--follow` must be valid `http`/`https` URLs (or `host:port` shorthand). Loopback (`localhost`, `127.0.0.1`, `::1`) is the expected default. Non-loopback URLs print a warning; cloud metadata and link-local hosts are **rejected**. Pass `--allow-remote-companion` when you intentionally follow a remote staging URL.
- Config-file restarts restart shell Vite only; the companion keeps running.
- `--app` does not spawn a companion itself. The nested `shellui start` from Tauri will, if `dev.run` is set.

See also [Companion origin isolation](/features/companion-isolation) for iframe sandbox notes (M-18).

### shellui build [root]

Build a production static site to `dist/web/`. Same isolated toolchain as `start`. `--app` also builds native bundles under `dist/app/`. `--bundles` selects desktop formats (default `app`; `app,dmg` on macOS). See [Desktop app - bundle targets](/tauri#bundle-targets).

`shellui build` sets Vite `base` to `/`, so `index.html` and `404.html` reference `/assets/…` and `/favicon.svg`. Opening or refreshing a nested route requests those files from the site root. The build writes `404.html` (a copy of root `index.html`) for SPA fallbacks and materializes `dist/web/<path>/index.html` for navigation paths plus shell built-in routes (`/login`, `/login/callback`, `/__settings`, legal pages, …).

### shellui login [root]

Sign in against identity-service and store CLI credentials (mode `0600`) for later commands such as `deploy`.

```bash
shellui login
shellui login --config ./config
shellui login --provider github
```

Walks from `[root]` (or cwd) up to `.git` looking for config. Binds a loopback HTTP server on `127.0.0.1:<port>`, prints a **session nonce**, and opens `{backend.url}/api/v1/authorize?company_id=…&redirect_to=http://127.0.0.1:<port>/callback&state=<nonce>&code_challenge=…&code_challenge_method=S256`. The PKCE verifier stays in the CLI process memory. Loopback is always allowlisted when `DEBUG=true` or `OAUTH_ALLOW_LOOPBACK_REDIRECTS=true` on identity.

After sign-in, identity **0.5.0+** redirects to the loopback URL with `?shellui_auth_code=…`. The callback page posts the code to the CLI (`/code`, nonce-bound). The CLI redeems it at `POST /api/v1/oauth/session` with `code_verifier` and the loopback `Origin`, which matches `redirect_to` as identity 0.9.0 requires. Identity 0.9.0 ignores fragment delivery (`#access_token=…`).

**Loopback threat model (Track F / L-11, L-12):**

- The CLI `/capture` endpoint accepts tokens only when the POST includes the one-time session nonce (header `X-Shellui-Login-Nonce` and JSON `nonce`). This blocks other local processes from posting tokens while `shellui login` is active.
- **Social-engineering residual:** a malicious site can still phish the authorize URL printed in your terminal. Only trust URLs whose path starts with `{backend.url}/api/v1/authorize`. Loopback pages show the port and nonce. Verify they match your terminal before completing sign-in.
- Auth codes and URL fragments are cleared with `history.replaceState` after capture.

Required config: `backend.type: "shellui"`, `backend.companyId`, `backend.url` (default `https://id.shellui.com`). A running shell / `backend.loginUrl` is not required. Register `{backend.url}/api/v1/oauth/callback` on the OAuth provider app.

**Credentials:** stored per account, keyed by `backend.url` plus `backend.companyId`. Each account gets its own OS keychain entry (service `shellui`, account `cli-credentials:<backend.url>#<companyId>`) through the optional `@napi-rs/keyring` package. If the keychain is not available, the CLI warns once and writes tokens to `~/.config/shellui/credentials.json` (or `$XDG_CONFIG_HOME/shellui/credentials.json`, Windows `%APPDATA%\shellui\credentials.json`) with mode `0600` (directory `0700`), under the same keys. The file fallback limits exposure to your user account but does **not** protect against root, malware or backups. `accounts.json` in the same folder lists account keys and the current one, never tokens. A login stored by an older CLI version moves to the per-account layout on first use. Tokens are never printed.

Commands use the account named in the project's `shellui.config.json`. Outside a project they use the last account you logged in with.

### shellui logout / whoami

`shellui logout` removes the stored credentials for the current account (`shellui logout --all` removes every account) and best-effort `POST /api/v1/logout` with the access token and refresh token (when present) so identity revokes the server session. `shellui whoami` calls `GET /api/v1/user` and refreshes the access token when expired, persisting rotated refresh tokens.

### shellui deploy [root]

Upload `dist/web/` to [hosting-service](https://github.com/shellui/hosting-service) as a **preview** site (7-day TTL unless you redeploy the same slug). Requires `shellui login` and `hosting.url`. After the first deploy of a new preview, the CLI saves the returned slug to `hosting.slug` in `shellui.config.json` and prints the path. It never overwrites an existing `hosting.slug`, skips `--slug` deploys, and leaves split configs untouched (it prints the slug to add instead).

```bash
shellui deploy
shellui deploy --build
shellui deploy --version 1.2.0 --slug my-preview
shellui deploy --dry-run
shellui deploy history
shellui deploy rollback --to 1.1.0
shellui deploy rollback --deployment your_deployment_uuid_here
```

Builds a `tar.gz` of `dist/web/` and uploads (create app if needed → create deployment → upload → finalize). App version comes from `--version`, `config.version`, or `package.json`. `shellui_version` comes from installed `@shellui/core`. Runs `shellui build` when `dist/web/` is missing or when `--build` is passed. When hosting reports the preview origin was not added to allowed redirects, the command prints a warning and still finishes the deploy.

In CI, set `SHELLUI_DEPLOY_TOKEN` instead of running `shellui login`. See [CI with deploy tokens](#ci-with-deploy-tokens).

**Required:** `hosting.url` (for example `http://localhost:8002`). Optional `hosting.slug` to redeploy the same preview. `--slug` overrides config. `--app` is a deprecated alias for `--slug`. `hosting.app` in config is ignored for preview deploys (CLI prints a warning). Optional `hosting.publicUrl` when browsable URLs differ from the API base. `hosting.showInAdmin: false` hides Admin → Hosting without affecting deploy.

### CI with deploy tokens

A deploy token lets CI create and update 7-day previews without a login. Previews are meant for workshops and demos. Create the token in admin: Hosting, Deploy tokens. Admin shows it once. Store it as a secret named `SHELLUI_DEPLOY_TOKEN`, never in your repository.

When `SHELLUI_DEPLOY_TOKEN` is set, the CLI skips the login session, sends the token to hosting as a bearer header and never prints it. A token belongs to your company: it can create a preview or redeploy any preview slug of your company, nothing else. Revoke it in admin when you no longer need it.

Run `shellui deploy` once locally and commit the saved `hosting.slug`, so each CI run updates the same preview instead of creating a new one.

```yaml
name: Preview
on:
  push:
    branches: [main]
jobs:
  preview:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      # Updates the preview saved in hosting.slug (shellui.config.json)
      - run: npx shellui deploy --build
        env:
          SHELLUI_DEPLOY_TOKEN: ${{ secrets.SHELLUI_DEPLOY_TOKEN }}
```

With a deploy token, finalize does not add the site origin to allowed sign-in redirects. Add it once from the app page in admin.

## Configuration

Load order inside the config directory:

1. `shellui.config.json`
2. Split `shellui.<name>.config.json` (only when no main JSON file is present)
3. `shellui.config.ts`

You cannot mix a main JSON file with split files. Config is validated against `@shellui/core` `schemas/shellui.config.schema.json`. Invalid config fails at load time.

### Custom config location

Default is project `[root]` (cwd). `--config` or `SHELLUI_CONFIG` points at another directory or a specific file. `--config` wins when both are set. Project root still holds `static/` and `dist/`.

```bash
shellui start --config ./config
shellui start --config ./config/shellui.config.json
export SHELLUI_CONFIG=./config
```

Point editors at the schema:

```json
{
  "$schema": "./node_modules/@shellui/core/schemas/shellui.config.schema.json",
  "port": 4000,
  "title": "My Application"
}
```

### Environment variable substitution

Any **string** in loaded config (JSON, split, or TypeScript export) may contain placeholders, resolved when the CLI loads config - after read, before schema validation, recursively:

| Syntax            | Behavior                                                         |
| ----------------- | ---------------------------------------------------------------- |
| `${VAR}`          | `process.env.VAR`. Unset or empty becomes `""` and the CLI warns |
| `${VAR:-default}` | `default` when `VAR` is unset or empty                           |

When a value is **exactly** one placeholder, the result is coerced if it looks like a JSON literal: `"${PORT:-4000}"` → number `4000`, `"${FLAG:-true}"` → boolean, `"${X:-null}"` → `null`. Embedded placeholders stay strings.

Substitution runs **only in the CLI**. The browser never reads `.env` to fill `${VAR}`. On `shellui build`, resolved values are embedded via `@shellui/config` and written to `dist/web/shellui.config.json`. There is no runtime override.

Treat config as public. URLs, feature flags, and publishable keys in `shellui.config.json` ship to the client. Keep secrets on a real backend.

```json
{
  "backend": {
    "type": "shellui",
    "url": "${SHELLUI_BACKEND_URL:-https://id.shellui.com}",
    "adminUrl": "${SHELLUI_ADMIN_URL:-https://admin.shellui.com}",
    "companyId": "${SHELLUI_COMPANY_ID:-1}"
  },
  "storage": {
    "url": "${SHELLUI_STORAGE_URL:-http://localhost:8001}"
  }
}
```

The CLI loads dotenv from the project `.env`. Sentry also merges from `SENTRY_DSN`, `SENTRY_ENABLED`, and related vars after load - see [Sentry](/sentry). A DSN in the frontend bundle is expected for client-side Sentry; it is still not a secret with write access to your infra.

### Selected fields

- **`port`** (number, optional): dev server port. Default `3000` if omitted (`init` writes `4000`).
- **`title`** (string, optional): chrome title.
- **`backend`**: see [Backend](/backend).
- **`storage`**: `url` (required when set), optional `filesUrl`, `showInSettings`. See [Storage](/features/storage).
- **`hosting`**: `url`, optional `slug`, `publicUrl`, `showInAdmin`.
- **`email`**: optional `url`, optional `showInAdmin`.
- **`navigation`**: see [Navigation](/features/navigation).
- **`dev`**: companion `run` / `url` / `name` - stripped before the config reaches the browser.

`email` sets the [email-service](https://github.com/shellui/email-service) origin the shell forwards on SDK `settings.email`. Set `url` explicitly (for example `http://localhost:8003` locally). Without `url`, or without `email`, the shell sends `settings.email: null`. There is no built-in default. `email.showInAdmin: false` hides Admin → Email. A navigation item can set its own `email`, `storage`, and `hosting`; see [Apps on another identity server](/features/authentication#apps-on-another-identity-server).

```json
{
  "email": {
    "url": "http://localhost:8003"
  }
}
```

### Trusted config paths (Track F / L-13)

Shellui config can execute code: TypeScript configs run via `tsx` with the CLI's privileges; JSON still controls dev companions and deploy targets.

- Prefer **`shellui.config.json`** (or split JSON). Run `shellui config migrate` to move off TypeScript for CI-safe configs.
- **`--config` / `SHELLUI_CONFIG`:** loading config from outside the project root prints a warning. World-writable config paths are rejected; symlink escapes outside the project root are rejected.
- TypeScript load prints an additional warning. Treat config like source code — only from trusted repositories.

TypeScript config is an advanced fallback. Prefer JSON. Example when you need `readFileSync` for legal markdown:

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  port: 4000,
  title: 'My Shellui App',
  backend: {
    type: 'supabase',
    url: 'http://localhost:54321',
  },
  navigation: [
    {
      label: 'Documentation',
      path: 'docs',
      url: 'https://docs.example.com/',
      icon: '/icons/book-open.svg',
    },
  ],
};

export default config;
```

`shellui start` watches the active config files and restarts the shell Vite process on change.

## Project layout

```text
my-project/
├── shellui.config.json
├── package.json
├── static/
├── dist/
│   ├── web/
│   └── app/
└── node_modules/
```

The CLI does not replace your app toolchain. Set `dev.run` so one `shellui start` also runs the iframe app. The [playground](https://github.com/shellui/playground) uses one pnpm project for both.

## Tooling isolation

`shellui start` and `shellui build` use an inline Vite config (`configFile: false`). They never merge the consumer project's toolchain.

| Consumer file                           | What the shell uses                                                      |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `vite.config.*`                         | Inline config, root = `@shellui/core`                                    |
| `postcss.config.*`, `tailwind.config.*` | CLI PostCSS + Tailwind v4, scan limited to `@shellui/core/src`           |
| `tsconfig.json` / `jsconfig.json`       | Inline `esbuild.tsconfigRaw` (React JSX)                                 |
| `.env`, `.env.*`, `VITE_*`              | Vite `envDir: false`; `import.meta.env` prefix is `SHELLUI_PUBLIC_` only |
| `node_modules/.vite`                    | `node_modules/.vite-shellui`                                             |

`${VAR}` in config still reads process env (including project `.env` via dotenv) at CLI load time. Those values are for config substitution, not Vite `import.meta.env`. The dev server does not serve project `src/` - only `@shellui/core`, `node_modules`, `static/`, and optional `themesDir`.

## Troubleshooting

**`command not found: shellui`.** Install globally or use `npx shellui start`.

**Configuration not found.** Add `shellui.config.json` or run `shellui init`. Pass `--config` if files live elsewhere.

**Port already in use.** Change `port` in config.

**TypeScript config not loading.** Used only when no JSON or split config is present. Export a serializable `export default` or `export const config`. Install `typescript` as a dev dependency if evaluation fails.

**`Not logged in`.** Run `shellui login`, or set `SHELLUI_DEPLOY_TOKEN` in CI.

**`SHELLUI_DEPLOY_TOKEN was revoked` or `has expired`.** Create a new token in admin and update the CI secret.

**`SHELLUI_DEPLOY_TOKEN is not a valid deploy token`.** The secret is empty, truncated or from another hosting server. Copy it again from a new token.

**`Deploy tokens only deploy preview sites`.** `hosting.slug` names an app created in admin. Use a preview slug, or remove `hosting.slug` to create a new preview.

**Each CI run creates a new preview.** Commit `hosting.slug` in `shellui.config.json`.
