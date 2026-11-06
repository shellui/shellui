# @shellui/cli

Command-line tool for Shellui, the open-source app shell. Create a project from a React, Vue, Svelte, Angular or other template, run it, build it, and deploy 7-day preview links. Install it, then run `shellui` to create a project, start the host, and build.

## Installation

```bash
npm install -g @shellui/cli
```

Or as a project dev dependency:

```bash
npm install --save-dev @shellui/cli
```

Shellui **0.6.2** is the current stable release: `npm install -g @shellui/cli@0.6.2`.

## Usage

```bash
shellui init
shellui init react
shellui start
shellui start --host
shellui start --app
shellui start --run vite --follow http://localhost:5173
shellui start --shell-only
shellui build
shellui build --app
shellui build --app --bundles app,dmg
shellui config migrate
shellui config split
shellui config unsplit
shellui login
shellui logout
shellui whoami
shellui deploy
shellui auth status
shellui companies list
shellui projects list --json
shellui projects regions
shellui projects endpoints
shellui storage buckets list
shellui hosting apps list
shellui hosting deployments list
shellui start --config ./config
```

`dev` is an alias for `start`. `--shell-only` ignores `config.dev.run`. Do not pass `--no-run`.

### AI-native commands (auth session, not deploy tokens)

These require `shellui login` (human OAuth loopback to identity). They send `Authorization: Bearer <access token>`. They do **not** use `SHELLUI_DEPLOY_TOKEN`; that env var applies only to `shellui deploy`.

- **`shellui companies`** - Identity `GET /api/v1/companies/`. Ids are **regional** decimal tenant ids. `companies use <id>` stores that default in `cli-session.json` (v2 field `regionalCompanyId`).
- **`shellui projects`** - SaaS on `saas.url` or `SHELLUI_SAAS_URL` (dev fallback in the CLI: `http://localhost:8005`; self-host smoke stacks often use the same host). Companies here are **dashboard UUIDs**, not regional decimals: `GET {saas}/saas/api/v1/companies/`, `GET {saas}/saas/api/v1/companies/<uuid>/`, `GET {saas}/api/v1/regions/`, `GET {saas}/api/v1/companies/<uuid>/endpoints/`. No `company_id` query. `projects use <uuid>` saves `dashboardCompanyUuid` for `endpoints` when you omit the argument. **`projects create` is not implemented** (exit with guidance to use the dashboard or global MCP OAuth where policy allows).
- **`shellui storage buckets list|get`** - Storage `GET /storage/v1/bucket` and `GET /storage/v1/bucket/<name>`. Tenant comes from the JWT only (no `company_id` query). Optional `--company` selects the regional scope for validation (flag, `companies use`, or `backend.companyId`).
- **`shellui hosting apps` / `hosting deployments`** - Hosting read APIs with the same JWT. `deployments status` loads the deployments list and finds the UUID (there is no separate per-deployment GET).

Global MCP agents use OAuth and in-product tool approvals for writes; the CLI session is a separate channel. See the published CLI reference for tables and troubleshooting.

**init frameworks:** `empty`, `react`, `vue`, `angular`, `next`, `nuxt`, `svelte`, `alpine`. Each JS starter wires theme and i18n with `@shellui/sdk/tiny`. See [Framework starters](https://docs.shellui.com/framework-starters).

Full command and config reference: [CLI docs](https://docs.shellui.com/cli). Desktop: [Tauri / desktop app](https://docs.shellui.com/tauri). `shellui start` / `build` ignore the project `vite.config`, PostCSS, Tailwind, `tsconfig`, and `VITE_*` - see [tooling isolation](https://docs.shellui.com/cli#tooling-isolation).

## Project structure (this package)

```text
src/
├── cli.js
├── commands/
└── utils/
```

Adding a command: implement it under `src/commands/`, export from `src/commands/index.js`, register it in `src/cli.js`. See `src/commands/README.md`.

## License

MIT
