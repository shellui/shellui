// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FullscreenLayout } from './FullscreenLayout';

const env = { mac: false, root: true };

vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' } }) }));
vi.mock('../chrome/runtime', () => ({
  useIsTauriClient: () => env.mac,
  useMacOverlayChrome: () => env.mac,
  useMacTrafficLights: () => env.mac,
}));
vi.mock('../chrome/DesktopHistoryButtons', () => ({ DesktopHistoryButtons: () => null }));
vi.mock('../chrome/SafeAreaTopbar', () => ({ isShellUiRootWindow: () => env.root }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  env.mac = false;
  env.root = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function main(): HTMLElement {
  act(() =>
    root.render(
      <MemoryRouter>
        <FullscreenLayout navigation={[]}>
          <p>content</p>
        </FullscreenLayout>
      </MemoryRouter>,
    ),
  );
  const el = container.querySelector<HTMLElement>('[data-shellui-fullscreen]');
  if (!el) throw new Error('missing main');
  return el;
}

describe('FullscreenLayout safe areas', () => {
  it('pads the root window for the notch and home indicator', () => {
    expect(main().className).toContain('shellui-fullscreen-safe');
  });

  it('does not pad again inside a nested shell iframe', () => {
    env.root = false;
    expect(main().className).not.toContain('shellui-fullscreen-safe');
  });

  it('keeps the macOS strip padding instead', () => {
    env.mac = true;
    const el = main();
    expect(el.className).not.toContain('shellui-fullscreen-safe');
    expect(el.style.paddingTop).toBe('48px');
  });
});
