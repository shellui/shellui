import { loginCommand } from './commands/login.js';

/**
 * Register `shellui login`. cac turns `--no-browser` into `options.browser === false`
 * (and leaves `browser` undefined or true otherwise), so that is the field to read.
 * @param {import('cac').CAC} cli
 * @param {typeof loginCommand} [handler]
 * @param {string} configHelp
 */
export function registerLoginCommand(cli, handler = loginCommand, configHelp = '') {
  cli
    .command('login [root]', 'Sign in with device authorization and store CLI credentials')
    .option('--config <path>', configHelp)
    .option('--no-browser', 'Print the link and code without opening a browser')
    .action((root, options) =>
      handler(root, {
        config: options.config,
        noBrowser: options.browser === false,
      }),
    );
}
