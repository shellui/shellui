import { describe, expect, it } from 'vitest';
import {
  refreshFrameAccessTokenIfNeeded,
  registerFrameSessionRefresher,
} from './frameSessionRefresher';

describe('refreshFrameAccessTokenIfNeeded', () => {
  it('returns undefined until a refresher is registered, then the token it resolves', async () => {
    expect(await refreshFrameAccessTokenIfNeeded()).toBeUndefined();

    const stop = registerFrameSessionRefresher(async () => 'fresh-access');
    expect(await refreshFrameAccessTokenIfNeeded()).toBe('fresh-access');

    stop();
    expect(await refreshFrameAccessTokenIfNeeded()).toBeUndefined();
  });

  it('passes through null when the shell has no session', async () => {
    const stop = registerFrameSessionRefresher(async () => null);
    expect(await refreshFrameAccessTokenIfNeeded()).toBeNull();
    stop();
  });
});
