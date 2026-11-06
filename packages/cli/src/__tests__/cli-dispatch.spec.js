import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { dispatchVariadicCli } from '../cli-dispatch.js';

vi.mock('../commands/auth-status.js', () => ({
  authStatusCommand: vi.fn(async () => {}),
}));

vi.mock('../commands/storage-buckets.js', () => ({
  storageBucketsCommand: vi.fn(async () => {}),
}));

vi.mock('../commands/hosting-apps.js', () => ({
  hostingAppsCommand: vi.fn(async () => {}),
}));

vi.mock('../commands/hosting-deployments.js', () => ({
  hostingDeploymentsCommand: vi.fn(async () => {}),
}));

vi.mock('../commands/projects.js', () => ({
  projectsCommand: vi.fn(async () => {}),
}));

describe('dispatchVariadicCli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  test('auth status dispatches authStatusCommand', async () => {
    const { authStatusCommand } = await import('../commands/auth-status.js');
    await dispatchVariadicCli(['auth', 'status'], {});
    expect(authStatusCommand).toHaveBeenCalledOnce();
  });

  test('auth typo sets nonzero exit', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await dispatchVariadicCli(['auth', 'stat'], {});
    expect(process.exitCode).toBe(1);
    err.mockRestore();
  });

  test('storage buckets list dispatches', async () => {
    const { storageBucketsCommand } = await import('../commands/storage-buckets.js');
    await dispatchVariadicCli(['storage', 'buckets', 'list'], {});
    expect(storageBucketsCommand).toHaveBeenCalledWith('list', undefined, expect.any(Object));
  });

  test('storage buckets unknown action sets exit', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await dispatchVariadicCli(['storage', 'buckets', 'nope'], {});
    expect(process.exitCode).toBe(1);
    err.mockRestore();
  });

  test('projects list dispatches with one list arg', async () => {
    const { projectsCommand } = await import('../commands/projects.js');
    await dispatchVariadicCli(['projects', 'list'], {});
    expect(projectsCommand).toHaveBeenCalledWith('list', undefined, expect.any(Object));
  });

  test('hosting deployments list dispatches', async () => {
    const { hostingDeploymentsCommand } = await import('../commands/hosting-deployments.js');
    await dispatchVariadicCli(['hosting', 'deployments', 'list'], { slug: 's' });
    expect(hostingDeploymentsCommand).toHaveBeenCalledWith(
      'list',
      undefined,
      expect.objectContaining({ slug: 's' }),
    );
  });
});
