# CLI Commands

This directory contains all CLI commands, each in its own file for better maintainability.

## Structure

Each command is a separate file that exports a command function:

- `start.js` - Start the Shellui development server (`dev` alias, `--app` for Tauri, optional companion `--run` / `--follow`)
- `build.js` - Build the Shellui application for production (`--app` for Tauri)
- `init.js` - Create a `shellui.config.json` boilerplate
- `config.js` - `config migrate` / `config split` / `config unsplit`
- `login.js` - `shellui login` (OAuth device authorization against identity-service; `--no-browser` skips opening the verification page)
- `auth-status.js` - `auth status` (session summary, no token output)
- `companies.js` - `companies list|get|use` (identity `GET /api/v1/companies/`; `use` stores a **regional** decimal tenant id in `cli-session.json`)
- `projects.js` - `projects list|get|use|regions|endpoints` (SaaS dashboard on `saas.url`; global company **UUIDs** in paths; `create` is not implemented). See `../http/dashboard-http.js` and `../http/saas-paths.js`
- `storage-buckets.js` - `storage buckets list|get` (storage-service; Bearer JWT only, **no** `company_id` query)
- `hosting-apps.js` / `hosting-deployments.js` - `hosting apps|deployments` (hosting-service; same JWT pattern)

Regional services use `../http/service-http.js` (`regionalServiceFetch`). Optional `company_id` query is omitted for storage and hosting (`omitCompanyQuery: true`); the JWT carries the tenant. `resolveRegionalCompanyScope` in `../cli-context/company-scope.js` validates the regional id for commands that need an explicit tenant choice (`storage buckets` uses it so a missing `backend.companyId` fails fast with a clear error).

## Adding a New Command

1. Create a new file in this directory (e.g. `new-command.js`)
2. Export a function that implements the command logic:

```javascript
export async function newCommandCommand(args) {
  // Command implementation
}
```

3. Register it in `cli.js`:

```javascript
import { newCommandCommand } from './commands/index.js';

cli.command('new-command [args]', 'Description of the command').action(newCommandCommand);
```

4. Export it from `commands/index.js`:

```javascript
export { newCommandCommand } from './new-command.js';
```

## Available Commands

- **dev** / **start** - Starts the development server (`--app` for Tauri desktop; `--run` / `--follow` companion)
- **build** - Builds the application for production (`--app` for Tauri desktop)
- **init** - Creates a `shellui.config.json` boilerplate
- **config migrate** - Evaluates TypeScript config and writes JSON
- **config split** / **config unsplit** - Split or merge JSON configuration files
- **login** - Device authorization against identity-service (`--no-browser` prints the link and code only). Tokens stay in the OS keychain, or a mode `0600` file when the keychain is unavailable
- **auth status** - Login and credential summary (no tokens)
- **companies** - List or fetch regional organizations; `use` stores a default **decimal** tenant id for identity-backed flows
- **projects** - SaaS dashboard companies and `api/v1` regions or endpoints (human `shellui login` session; no `company_id` query). **create** exits with `not_implemented` (use the dashboard or global MCP OAuth where policy allows)
- **storage buckets** - List or get buckets (JWT tenant only)
- **hosting apps** / **hosting deployments** - Inspect sites and deployment rows (JWT tenant only; `deployments status` resolves UUID from the list; there is no per-deployment GET)
