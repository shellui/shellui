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
  .action((root, options) => startCommand(root, options));

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
  .command('init [root]', 'Create a shellui.config.json boilerplate')
  .option('--force', 'Overwrite existing config file')
  .option('--config <path>', CONFIG_OPTION_HELP)
  .action((root, options) => initCommand(root, options));

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

cli.command('logout', 'Remove stored shellui CLI credentials').action(() => logoutCommand());

cli
  .command('whoami', 'Show the profile for the stored CLI credentials')
  .action(() => whoamiCommand());

// Setup CLI metadata
cli.help();
cli.version(pkg.version);
cli.parse();
