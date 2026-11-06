# CLI Commands

This directory contains all CLI commands, each in its own file for better maintainability.

## Structure

Each command is a separate file that exports a command function:

- `start.js` - Start the Shellui development server (`dev` alias, `--app` for Tauri, optional companion `--run` / `--follow`)
- `build.js` - Build the Shellui application for production (`--app` for Tauri)
- `init.js` - Create a `shellui.config.json` boilerplate
- `config.js` - `config migrate` / `config split` / `config unsplit`
- `auth-status.js` - `auth status` (session summary, no token output)
- `companies.js` - `companies list|get|use` (identity `/api/v1/companies`)
- `projects.js` - `projects list|get|create` (SaaS REST base from `saas.url` or `SHELLUI_SAAS_URL`)
- `storage-buckets.js` - `storage buckets list|get|create` (storage-service)
- `hosting-apps.js` / `hosting-deployments.js` - `hosting apps|deployments` (hosting-service)

Regional HTTP calls share `../http/service-http.js` (bearer session + `company_id` query). Company scope resolves in `../cli-context/company-scope.js`.

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
- **auth status** - Login and credential summary (no tokens)
- **companies** - List or fetch companies; `use` stores a default company id for regional commands
- **projects** - SaaS project API (human session bearer; `company_id` query)
- **storage buckets** - List or get buckets; optional create matches OpenAPI (often 403 in production)
- **hosting apps** / **hosting deployments** - Inspect sites and deployment rows (same JWT as deploy)
