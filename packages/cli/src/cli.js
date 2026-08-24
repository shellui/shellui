import 'dotenv/config';
import { cac } from 'cac';
import { startCommand, buildCommand, initCommand, configCommand } from './commands/index.js';
import pkg from '../package.json' with { type: 'json' };

const cli = cac('shellui');

const CONFIG_OPTION_HELP =
  'Path to config file or directory (default: project root). Also: SHELLUI_CONFIG';

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

// Setup CLI metadata
cli.help();
cli.version(pkg.version);
cli.parse();
