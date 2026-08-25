/**
 * Tiny injectable Shellui client (`dist/shellui.tiny.js`).
 * Browser-only: handshake + URL sync + theme / language / region.
 */

export interface ThemeColorsMode {
  [key: string]: string;
}

export interface ThemeColors {
  light: ThemeColorsMode;
  dark: ThemeColorsMode;
}

export interface ThemeSnapshot {
  name?: string;
  displayName?: string;
  mode: 'light' | 'dark';
  colorScheme?: string;
  colors: ThemeColorsMode | null;
  allColors?: ThemeColors | null;
  fontFamily?: string;
  bodyFontFamily?: string;
  headingFontFamily?: string;
  letterSpacing?: string;
  textShadow?: string;
  lineHeight?: string;
  [key: string]: unknown;
}

export interface RegionSnapshot {
  timezone: string;
}

export type TinyEventMap = {
  ready: ShellUITiny;
  theme: ThemeSnapshot | null;
  language: string | null;
  region: RegionSnapshot | null;
};

export type TinyEvent = keyof TinyEventMap;

type Fn<E extends TinyEvent> = (data: TinyEventMap[E]) => void;

export interface ShellUITiny {
  readonly ready: Promise<void>;
  readonly initialized: boolean;
  readonly theme: ThemeSnapshot | null;
  readonly language: string | null;
  readonly region: RegionSnapshot | null;
  on<E extends TinyEvent>(event: E, cb: Fn<E>): () => void;
  navigate(url: string): void;
  applyTheme(el?: HTMLElement): void;
}

type Appearance = {
  mode?: string;
  colorScheme?: string;
  colors?: ThemeColors;
  name?: string;
  displayName?: string;
  fontFamily?: string;
  bodyFontFamily?: string;
  headingFontFamily?: string;
  letterSpacing?: string;
  textShadow?: string;
  lineHeight?: string;
};

const listeners: Record<string, Fn<TinyEvent>[]> = {};
let path = location.pathname + location.search + location.hash;
let theme: ThemeSnapshot | null = null;
let language: string | null = null;
let region: RegionSnapshot | null = null;
let ready = false;
let resolveReady!: () => void;
const readyPromise = new Promise<void>((r) => {
  resolveReady = r;
});

const post = (type: string, payload: object = {}) => {
  if (parent !== window) parent.postMessage({ type, payload }, '*');
};

const emit = (event: string, data: unknown) => {
  const list = listeners[event];
  if (!list) return;
  for (let i = 0; i < list.length; i++) {
    try {
      list[i](data as never);
    } catch {
      /* ignore */
    }
  }
};

const applySettings = (settings?: {
  appearance?: Appearance;
  language?: { code?: string };
  region?: { timezone?: string };
}) => {
  if (!settings) return;
  const a = settings.appearance;
  if (a) {
    const mode: 'light' | 'dark' = a.mode === 'dark' ? 'dark' : 'light';
    theme = {
      ...a,
      mode,
      colors: a.colors?.[mode] ?? null,
      allColors: a.colors ?? null,
    };
  } else {
    theme = null;
  }
  language = settings.language?.code ?? null;
  region = settings.region?.timezone ? { timezone: settings.region.timezone } : null;
  emit('theme', theme);
  emit('language', language);
  emit('region', region);
};

const notifyUrl = () => {
  const fullPath = location.pathname + location.search + location.hash;
  if (fullPath === path) return;
  path = fullPath;
  post('SHELLUI_URL_CHANGED', {
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
    fullPath,
  });
};

const wrapHistory = (fn: History['pushState']) =>
  function (this: History, ...args: Parameters<History['pushState']>) {
    const result = fn.apply(this, args);
    notifyUrl();
    return result;
  };

addEventListener('popstate', notifyUrl);
addEventListener('hashchange', notifyUrl);
history.pushState = wrapHistory(history.pushState);
history.replaceState = wrapHistory(history.replaceState);

addEventListener('message', (event: MessageEvent) => {
  const data = event.data;
  if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
  const type = data.type as string;
  if (type !== 'SHELLUI_SETTINGS' && type !== 'SHELLUI_SETTINGS_UPDATED') return;
  applySettings(data.payload?.settings);
  if (!ready && type === 'SHELLUI_SETTINGS') {
    ready = true;
    post('SHELLUI_INITIALIZED');
    resolveReady();
    emit('ready', api);
  }
});

if (parent !== window) post('SHELLUI_SETTINGS_REQUESTED');
else {
  ready = true;
  resolveReady();
}

const FONT_VARS: [keyof Appearance, string][] = [
  ['fontFamily', '--font-family'],
  ['bodyFontFamily', '--body-font-family'],
  ['headingFontFamily', '--heading-font-family'],
  ['letterSpacing', '--letter-spacing'],
  ['textShadow', '--text-shadow'],
  ['lineHeight', '--line-height'],
];

const api: ShellUITiny = {
  get ready() {
    return readyPromise;
  },
  get initialized() {
    return ready;
  },
  get theme() {
    return theme;
  },
  get language() {
    return language;
  },
  get region() {
    return region;
  },
  on(event, cb) {
    (listeners[event] ??= []).push(cb as Fn<TinyEvent>);
    return () => {
      const list = listeners[event];
      if (!list) return;
      const i = list.indexOf(cb as Fn<TinyEvent>);
      if (i >= 0) list.splice(i, 1);
    };
  },
  navigate(url) {
    post('SHELLUI_NAVIGATE', { url });
  },
  applyTheme(el = document.documentElement) {
    const colors = theme?.colors;
    if (!theme || !colors) return;
    el.classList.toggle('dark', theme.mode === 'dark');
    for (const key in colors) {
      const value = colors[key];
      if (typeof value === 'string') {
        el.style.setProperty(`--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`, value);
      }
    }
    for (let i = 0; i < FONT_VARS.length; i++) {
      const [prop, css] = FONT_VARS[i];
      const value = theme[prop];
      if (typeof value === 'string') el.style.setProperty(css, value);
    }
  },
};

window.shellui = api;

export default api;
export { api as shellui };

declare global {
  interface Window {
    shellui: ShellUITiny;
  }
}
