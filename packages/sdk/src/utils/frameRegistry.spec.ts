import { describe, expect, it, beforeAll, vi } from 'vitest';
import { FrameRegistry, FRAME_LIVE_MESSAGE_TYPES } from './frameRegistry.js';

class FakeIFrameElement {
  src = '';
  contentWindow: Window | null = null;
}

beforeAll(() => {
  vi.stubGlobal('HTMLIFrameElement', FakeIFrameElement);
});

describe('FrameRegistry live handshake', () => {
  it('marks frames live and clears on remove', () => {
    const registry = new FrameRegistry();
    const iframe = new FakeIFrameElement() as unknown as HTMLIFrameElement;
    const uuid = registry.addIframe(iframe);

    expect(registry.isLive(uuid)).toBe(false);
    expect(registry.getLiveIframes()).toHaveLength(0);

    registry.markLive(uuid);
    expect(registry.isLive(uuid)).toBe(true);
    expect(registry.getLiveIframes()).toEqual([[uuid, iframe]]);

    registry.removeIframe(uuid);
    expect(registry.isLive(uuid)).toBe(false);
    expect(registry.getAllIframes()).toHaveLength(0);
  });

  it('ignores markLive for unknown uuids', () => {
    const registry = new FrameRegistry();
    registry.markLive('missing');
    expect(registry.isLive('missing')).toBe(false);
  });

  it('defines handshake live message types', () => {
    expect(FRAME_LIVE_MESSAGE_TYPES.has('SHELLUI_SETTINGS_REQUESTED')).toBe(true);
    expect(FRAME_LIVE_MESSAGE_TYPES.has('SHELLUI_INITIALIZED')).toBe(true);
  });
});
