import 'dotenv/config';
import { cac } from 'cac';
import { startCommand, buildCommand, initCommand } from './commands/index.js';
import pkg from '../package.json' with { type: 'json' };

const cli = cac('shellui');

// Register commands
cli
  .command('start [root]', 'Start the shellui server (alias: dev)')
  .alias('dev')
  .option('--host', 'Listen on 0.0.0.0 to allow access from network')
  .option('--app', 'Start as a desktop app (generates dist/app/ on first run)')
  .option('--target <target>', 'Build target: web or tauri')
  .action((root, options) => startCommand(root, options));

cli
  .command('build [root]', 'Build the shellui application')
  .option('--app', 'Build the desktop app (web to dist/web/, native bundles under dist/app/)')
  .option(
    '--bundles <targets>',
    'Desktop bundle targets (default: app). Example: app,dmg for macOS DMG installer',
  )
  .option('--target <target>', 'Build target: web or tauri')
  .action((root, options) => buildCommand(root, options));

cli
  .command('init [root]', 'Create a shellui.config.ts boilerplate')
  .option('--force', 'Overwrite existing config file')
  .action((root, options) => initCommand(root, options));

// Setup CLI metadata
cli.help();
cli.version(pkg.version);
cli.parse();
