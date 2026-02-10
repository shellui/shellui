import 'dotenv/config';
import { cac } from 'cac';
import { startCommand, buildCommand, initCommand } from './commands/index.js';
import pkg from '../package.json' with { type: 'json' };

const cli = cac('shellui');

// Register commands
cli.command('start [root]', 'Start the shellui server').action(startCommand);

cli.command('build [root]', 'Build the shellui application').action(buildCommand);

cli
  .command('init [root]', 'Create a shellui.config.ts boilerplate')
  .option('--force', 'Overwrite existing config file')
  .action((root, options) => initCommand(root, options));

// Setup CLI metadata
cli.help();
cli.version(pkg.version);
cli.parse();
