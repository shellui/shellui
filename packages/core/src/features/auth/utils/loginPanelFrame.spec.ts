import { describe, expect, it, vi } from 'vitest';

const addIframe = vi.fn(() => 'frame-1');
const removeIframe = vi.fn();
vi.mock('@shellui/sdk', () => ({ addIframe, removeIframe }));

const { registerLoginPanelFrame } = await import('./loginPanelFrame');

describe('registerLoginPanelFrame', () => {
  it('registers the panel iframe so settings reach it, and unregisters on cleanup', () => {
    const node = {} as HTMLIFrameElement;
    const cleanup = registerLoginPanelFrame(node);
    expect(addIframe).toHaveBeenCalledWith(node);
    expect(removeIframe).not.toHaveBeenCalled();
    cleanup();
    expect(removeIframe).toHaveBeenCalledWith('frame-1');
  });

  it('does nothing without a node', () => {
    addIframe.mockClear();
    registerLoginPanelFrame(null)();
    expect(addIframe).not.toHaveBeenCalled();
  });
});
