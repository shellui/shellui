import { describe, expect, it } from 'vitest';
import { resolveStorageBridgeTarget } from './resolveStorageBridgeTarget';

const shell = {
  storageUrl: null as string | null,
  accessToken: 'global-token',
};

describe('resolveStorageBridgeTarget', () => {
  it('uses the nested frame storage URL and regional token', () => {
    expect(
      resolveStorageBridgeTarget(
        {
          storageUrl: 'https://storage.eu.shellui.com',
          accessToken: 'regional-token',
        },
        shell,
      ),
    ).toEqual({
      storageUrl: 'https://storage.eu.shellui.com',
      accessToken: 'regional-token',
    });
  });

  it('does not fall back to the shell when the nested frame has no storage URL', () => {
    expect(
      resolveStorageBridgeTarget(
        { storageUrl: null, accessToken: 'regional-token' },
        {
          storageUrl: 'https://storage.shell.example',
          accessToken: 'shell-token',
        },
      ),
    ).toEqual({
      storageUrl: null,
      accessToken: 'regional-token',
    });
  });

  it('keeps the shell storage URL for a frame the shell hosts directly', () => {
    expect(
      resolveStorageBridgeTarget(null, {
        storageUrl: 'https://storage.example',
        accessToken: 'shell-token',
      }),
    ).toEqual({
      storageUrl: 'https://storage.example',
      accessToken: 'shell-token',
    });
  });
});
