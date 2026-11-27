import { cac } from 'cac';
import { describe, expect, test, vi } from 'vitest';
import { browserLaunchDecision } from '../auth/login-flow.js';
import { registerLoginCommand } from '../cli-login.js';

async function runLogin(args) {
  const handler = vi.fn();
  const cli = cac('shellui');
  registerLoginCommand(cli, handler, 'config help');
  cli.parse(['node', 'shellui', 'login', ...args], { run: false });
  await cli.runMatchedCommand();
  expect(handler).toHaveBeenCalledTimes(1);
  return handler.mock.calls[0];
}

describe('shellui login --no-browser', () => {
  test('passes noBrowser: true, and the flow then skips the browser', async () => {
    const [root, options] = await runLogin(['--no-browser']);
    expect(root).toBeUndefined();
    expect(options.noBrowser).toBe(true);
    // A graphical desktop would otherwise open the page.
    const decision = browserLaunchDecision({
      noBrowser: options.noBrowser,
      env: { DISPLAY: ':0' },
      platform: 'linux',
    });
    expect(decision.open).toBe(false);
    expect(decision.message).toContain('--no-browser');
  });

  test('keeps the browser on by default', async () => {
    const [, options] = await runLogin([]);
    expect(options.noBrowser).toBe(false);
    expect(
      browserLaunchDecision({
        noBrowser: options.noBrowser,
        env: { DISPLAY: ':0' },
        platform: 'linux',
      }).open,
    ).toBe(true);
  });

  test('still reads the project root and --config', async () => {
    const [root, options] = await runLogin(['./app', '--config', 'x.json', '--no-browser']);
    expect(root).toBe('./app');
    expect(options).toEqual({ config: 'x.json', noBrowser: true });
  });
});
