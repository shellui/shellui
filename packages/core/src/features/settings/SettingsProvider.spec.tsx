// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shellui, type ShellUIMessage } from '@shellui/sdk';
import { SettingsProvider } from './SettingsProvider';
import { useSettings } from './SettingsContext';

vi.mock('../config/useConfig', () => ({
  useConfig: () => ({ config: { navigation: [] }, isLoading: false }),
}));

vi.mock('../auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    session: null,
    syncUserPreferences: vi.fn(async () => undefined),
    loadUserPreferences: vi.fn(async () => null),
    logout: vi.fn(async () => undefined),
  }),
}));

function OllamaProbe() {
  const { settings } = useSettings();
  return <output>{settings.ai?.ollamaBaseUrl ?? ''}</output>;
}

describe('SettingsProvider settings messages', () => {
  let container: HTMLDivElement;
  let root: Root;
  let listeners: Map<string, (message: ShellUIMessage) => void>;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    listeners = new Map();
    vi.spyOn(shellui, 'addMessageListener').mockImplementation((type, cb) => {
      listeners.set(type, cb);
      return () => {
        if (listeners.get(type) === cb) listeners.delete(type);
      };
    });
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  async function renderProvider() {
    await act(async () => {
      root.render(
        <SettingsProvider>
          <OllamaProbe />
        </SettingsProvider>,
      );
    });
  }

  function frames(entries: Array<[string, string]>) {
    vi.spyOn(shellui.frameRegistry, 'getAllIframes').mockReturnValue(
      entries.map(([uuid, src]) => [uuid, { src } as HTMLIFrameElement]),
    );
  }

  function deliver(
    type: 'SHELLUI_SETTINGS' | 'SHELLUI_SETTINGS_UPDATED',
    from: string[],
    url: string,
  ) {
    const listener = listeners.get(type);
    expect(listener).toBeTypeOf('function');
    act(() => {
      listener?.({
        type,
        from,
        payload: { settings: { ai: { ollamaBaseUrl: url } } },
      } as ShellUIMessage);
    });
  }

  function shownUrl(): string {
    return container.querySelector('output')?.textContent ?? '';
  }

  it('rejects a settings update from a registered companion', async () => {
    const origin = window.location.origin;
    frames([
      ['companion', 'http://127.0.0.1:5175/'],
      ['same-origin-app', `${origin}/app/`],
    ]);
    await renderProvider();

    deliver('SHELLUI_SETTINGS_UPDATED', ['companion'], 'http://evil.example:11434');
    expect(shownUrl()).toBe('');
    expect(localStorage.getItem('shellui:settings')).toBeNull();
    expect(warn).toHaveBeenCalled();

    deliver('SHELLUI_SETTINGS', ['same-origin-app'], 'http://evil.example:11435');
    expect(shownUrl()).toBe('');
    expect(localStorage.getItem('shellui:settings')).toBeNull();
  });

  it('rejects a companion that is allowed to receive an access token', async () => {
    frames([['trusted-companion', 'http://127.0.0.1:5175/company']]);
    await renderProvider();
    deliver('SHELLUI_SETTINGS_UPDATED', ['trusted-companion'], 'http://evil.example:11434');
    expect(shownUrl()).toBe('');
    expect(warn).toHaveBeenCalled();
  });

  it('applies a settings update from a shell page', async () => {
    const origin = window.location.origin;
    frames([
      ['settings', `${origin}/__settings/ai`],
      ['cookies', `${origin}/__cookie-preferences`],
    ]);
    await renderProvider();

    deliver('SHELLUI_SETTINGS_UPDATED', ['settings'], 'http://127.0.0.1:11434');
    expect(shownUrl()).toBe('http://127.0.0.1:11434');
    expect(localStorage.getItem('shellui:settings')).toContain('http://127.0.0.1:11434');

    deliver('SHELLUI_SETTINGS_UPDATED', ['cookies'], 'http://127.0.0.1:11435');
    expect(shownUrl()).toBe('http://127.0.0.1:11435');
  });

  it('rejects a settings update relayed through another frame', async () => {
    const origin = window.location.origin;
    frames([['settings', `${origin}/__settings/ai`]]);
    await renderProvider();
    deliver(
      'SHELLUI_SETTINGS_UPDATED',
      ['settings', 'nested-companion'],
      'http://evil.example:11434',
    );
    expect(shownUrl()).toBe('');
    expect(warn).toHaveBeenCalled();
  });
});
