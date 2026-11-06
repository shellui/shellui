import 'dotenv/config';
import { cac } from 'cac';
import {
  startCommand,
  buildCommand,
  initCommand,
  configCommand,
  loginCommand,
  logoutCommand,
  whoamiCommand,
  deployCommand,
  deployHistoryCommand,
  deployRollbackCommand,
  authStatusCommand,
  companiesCommand,
  projectsCommand,
  storageBucketsCommand,
  hostingAppsCommand,
  hostingDeploymentsCommand,
} from './commands/index.js';
import pkg from '../package.json' with { type: 'json' };

const cli = cac('shellui');

const CONFIG_OPTION_HELP =
  'Path to config file or directory (default: walk up from cwd to .git). Also: SHELLUI_CONFIG';

// Register commands
cli
  .command('start [root]', 'Start the shellui server (alias: dev)')
  .alias('dev')
  .option('--host', 'Listen on 0.0.0.0 to allow access from network')
  .option('--app', 'Start as a desktop app (generates dist/app/ on first run)')
  .option('--target <target>', 'Build target: web or tauri')
  .option('--config <path>', CONFIG_OPTION_HELP)
  .option('--run <command>', 'Spawn a companion command (overrides config.dev.run)')
  .option('--follow <url>', 'Wait for / follow a companion URL (overrides config.dev.url)')
  .option(
    '--allow-remote-companion',
    'Allow non-loopback dev.url / --follow URLs (default: loopback only with warnings)',
  )
  .option('--shell-only', 'Do not spawn a companion even if config.dev.run is set')
  .action((root, options) =>
    startCommand(root, {
      ...options,
      noRun: options.shellOnly === true,
    }),
  );

cli
  .command('build [root]', 'Build the shellui application')
  .option('--app', 'Build the desktop app (web to dist/web/, native bundles under dist/app/)')
  .option(
    '--bundles <targets>',
    'Desktop bundle targets (default: app). Example: app,dmg for macOS DMG installer',
  )
  .option('--target <target>', 'Build target: web or tauri')
  .option('--config <path>', CONFIG_OPTION_HELP)
  .action((root, options) => buildCommand(root, options));

cli
  .command('init [framework]', 'Create a shellui project with interactive wizard')
  .option('--force', 'Overwrite existing config file')
  .option('--config <path>', CONFIG_OPTION_HELP)
  .option(
    '--framework <type>',
    'Framework type: empty, react, vue, angular, next, nuxt, svelte, alpine',
  )
  .option('--backend <type>', 'Backend type: none, shellui, supabase')
  .option('--company-id <id>', 'Shellui company ID (required for shellui backend)')
  .option('--supabase-url <url>', 'Supabase project URL (required for supabase backend)')
  .option('--no-install', 'Skip installing dependencies after scaffold')
  .action((framework, options) => initCommand(framework, options));

cli
  .command('config <action> [root]', 'Config tools: migrate | split | unsplit')
  .option('--config <path>', CONFIG_OPTION_HELP)
  .action((action, root, options) => configCommand(action, root, options));

cli
  .command('login [root]', 'Sign in to shellui (browser OAuth; stores CLI credentials)')
  .option('--config <path>', CONFIG_OPTION_HELP)
  .option('--provider <name>', 'OAuth provider (default: first from identity settings)')
  .action((root, options) =>
    loginCommand(root, {
      config: options.config,
      provider: options.provider,
    }),
  );

cli
  .command('logout [root]', 'Remove stored CLI credentials for this account')
  .option('--all', 'Remove every stored account')
  .option('--config <path>', CONFIG_OPTION_HELP)
  .action((root, options) => logoutCommand(root, { all: options.all, config: options.config }));

cli
  .command('whoami [root]', 'Show the profile for the stored CLI credentials')
  .option('--config <path>', CONFIG_OPTION_HELP)
  .action((root, options) => whoamiCommand(root, { config: options.config }));

cli
  .command('auth status [root]', 'Show login/session status (no tokens)')
  .option('--config <path>', CONFIG_OPTION_HELP)
  .option('--json', 'Machine-readable JSON on stdout')
  .action((root, options) =>
    authStatusCommand(root ?? '.', { config: options.config, json: options.json }),
  );

cli
  .command(
    'companies <action> [id] [root]',
    'List or inspect organizations (identity /api/v1/companies)',
  )
  .option('--config <path>', CONFIG_OPTION_HELP)
  .option('--json', 'Machine-readable JSON on stdout')
  .action((action, id, root, options) =>
    companiesCommand(action, id, {
      root: root ?? '.',
      config: options.config,
      json: options.json,
    }),
  );

cli
  .command(
    'projects <action> [id] [root]',
    'SaaS projects (requires saas.url or SHELLUI_SAAS_URL; uses logged-in session)',
  )
  .option('--config <path>', CONFIG_OPTION_HELP)
  .option(
    '--company <id>',
    'Company id (defaults to backend.companyId, CLI default, or shellui companies use)',
  )
  .option('--region <code>', 'Region code (create only)')
  .option('--name <name>', 'Display name (create only)')
  .option('--slug <slug>', 'Project slug (create only)')
  .option('--dry-run', 'Print create plan without calling the API')
  .option('--json', 'Machine-readable JSON on stdout')
  .action((action, id, root, options) =>
    projectsCommand(action, id, {
      root: root ?? '.',
      config: options.config,
      company: options.company,
      region: options.region,
      name: options.name,
      slug: options.slug,
      dryRun: options.dryRun,
      json: options.json,
    }),
  );

cli
  .command(
    'storage buckets <action> [name] [root]',
    'List, get, or create storage buckets (storage.url; create usually returns 403 on current service)',
  )
  .option('--config <path>', CONFIG_OPTION_HELP)
  .option('--company <id>', 'Company id for company_id query on the request')
  .option('--json', 'Machine-readable JSON on stdout')
  .action((action, name, root, options) =>
    storageBucketsCommand(action, name, {
      root: root ?? '.',
      config: options.config,
      company: options.company,
      json: options.json,
    }),
  );

cli
  .command(
    'hosting apps <action> [ref] [root]',
    'List hosted sites or get one by slug (hosting.url)',
  )
  .option('--config <path>', CONFIG_OPTION_HELP)
  .option('--company <id>', 'Company id for JWT context when required')
  .option('--json', 'Machine-readable JSON on stdout')
  .action((action, ref, root, options) =>
    hostingAppsCommand(action, ref, {
      root: root ?? '.',
      config: options.config,
      company: options.company,
      json: options.json,
    }),
  );

cli
  .command(
    'hosting deployments list [root]',
    'List deployments for a site (hosting.url; slug from --slug or hosting.slug)',
  )
  .option('--config <path>', CONFIG_OPTION_HELP)
  .option('--company <id>', 'Company id for JWT context when required')
  .option('--slug <slug>', 'Site slug (preview slug)')
  .option('--json', 'Machine-readable JSON on stdout')
  .action((root, options) =>
    hostingDeploymentsCommand('list', undefined, {
      root: root ?? '.',
      config: options.config,
      company: options.company,
      slug: options.slug,
      json: options.json,
    }),
  );

cli
  .command(
    'hosting deployments status <uuid> [root]',
    'Show one deployment by UUID (hosting.url; slug from --slug or hosting.slug)',
  )
  .option('--config <path>', CONFIG_OPTION_HELP)
  .option('--company <id>', 'Company id for JWT context when required')
  .option('--slug <slug>', 'Site slug (preview slug)')
  .option('--json', 'Machine-readable JSON on stdout')
  .action((uuid, root, options) =>
    hostingDeploymentsCommand('status', uuid, {
      root: root ?? '.',
      config: options.config,
      company: options.company,
      slug: options.slug,
      json: options.json,
    }),
  );

cli
  .command('deploy [action] [root]', 'Deploy dist/web to shellui hosting preview (7-day TTL)')
  .option('--build', 'Run shellui build before deploying')
  .option('--version <version>', 'App version (default: config.version or package.json)')
  .option('--slug <slug>', 'Preview site slug to redeploy (overrides hosting.slug)')
  .option('--app <slug>', 'Deprecated alias for --slug')
  .option('--dry-run', 'Print deployment plan without uploading')
  .option('--to <version>', 'Rollback: target app_version to activate')
  .option('--deployment <uuid>', 'Rollback: target deployment UUID to activate')
  .option('--config <path>', CONFIG_OPTION_HELP)
  .action((action, root, options) => {
    if (action === 'history') {
      return deployHistoryCommand(root, options);
    }
    if (action === 'rollback') {
      return deployRollbackCommand(root, options);
    }
    const deployRoot = action ?? root ?? '.';
    return deployCommand(deployRoot, options);
  });

// Setup CLI metadata
cli.help();
cli.version(pkg.version);
cli.parse();
