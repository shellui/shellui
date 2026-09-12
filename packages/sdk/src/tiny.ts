/**
 * Tiny injectable Shellui client (`dist/shellui.tiny.js`).
 * Browser-only: handshake + URL sync + theme / language / region / layout chrome.
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

export interface LayoutChromeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LayoutChromeSnapshot {
  layout: string;
  viewport: 'mobile' | 'tablet' | 'desktop';
  insets: LayoutChromeInsets;
  chromeVisible: boolean;
  autoPadding: boolean;
}

export type TinyEventMap = {
  ready: ShellUITiny;
  theme: ThemeSnapshot | null;
  language: string | null;
  region: RegionSnapshot | null;
  chrome: LayoutChromeSnapshot | null;
};

export type TinyEvent = keyof TinyEventMap;

type Fn<E extends TinyEvent> = (data: TinyEventMap[E]) => void;

export interface ShellUITiny {
  readonly ready: Promise<void>;
  readonly initialized: boolean;
  readonly theme: ThemeSnapshot | null;
  readonly language: string | null;
  readonly region: RegionSnapshot | null;
  readonly layoutChrome: LayoutChromeSnapshot | null;
  on<E extends TinyEvent>(event: E, cb: Fn<E>): () => void;
  navigate(url: string): void;
  applyTheme(el?: HTMLElement): void;
  applyLayoutChrome(options?: { autoPadding?: boolean; el?: HTMLElement }): void;
  reportContentScroll(payload: {
    scrollY: number;
    direction: 'up' | 'down' | 'none';
    distanceFromBottom?: number;
  }): void;
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
let layoutChrome: LayoutChromeSnapshot | null = null;
let autoLayoutPadding = true;
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

const LAYOUT_CHROME_PAD_CLASS = 'shellui-apply-layout-chrome-pad';
const LAYOUT_CHROME_PAD_STYLE_ID = 'shellui-layout-chrome-pad-styles';

const ensurePadStyles = () => {
  if (document.getElementById(LAYOUT_CHROME_PAD_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = LAYOUT_CHROME_PAD_STYLE_ID;
  style.textContent = `.${LAYOUT_CHROME_PAD_CLASS}{padding-top:var(--shellui-inset-top,0px);padding-right:var(--shellui-inset-right,0px);padding-bottom:var(--shellui-inset-bottom,0px);padding-left:var(--shellui-inset-left,0px);box-sizing:border-box}`;
  (document.head || document.documentElement).appendChild(style);
};

const setChromeVars = (chrome: LayoutChromeSnapshot | null, withPadding: boolean) => {
  ensurePadStyles();
  const el = document.documentElement;
  const insets = chrome?.insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
  el.style.setProperty('--shellui-inset-top', `${insets.top}px`);
  el.style.setProperty('--shellui-inset-right', `${insets.right}px`);
  el.style.setProperty('--shellui-inset-bottom', `${insets.bottom}px`);
  el.style.setProperty('--shellui-inset-left', `${insets.left}px`);

  const active = Boolean(
    chrome &&
    chrome.layout !== 'none' &&
    (insets.top > 0 || insets.right > 0 || insets.bottom > 0 || insets.left > 0),
  );
  if (active) el.setAttribute('data-shellui-layout-chrome', '');
  else el.removeAttribute('data-shellui-layout-chrome');

  // Iframe stays 100%×100%; padding is inside the app via CSS class / inset vars.
  const shouldPad = withPadding && active;
  if (shouldPad) el.setAttribute('data-shellui-layout-chrome-pad', '');
  else el.removeAttribute('data-shellui-layout-chrome-pad');

  const body = document.body;
  if (!body) return;
  if (shouldPad) body.classList.add(LAYOUT_CHROME_PAD_CLASS);
  else body.classList.remove(LAYOUT_CHROME_PAD_CLASS);
};

const applySettings = (settings?: {
  appearance?: Appearance;
  language?: { code?: string };
  region?: { timezone?: string };
  layoutChrome?: LayoutChromeSnapshot;
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
  if (settings.layoutChrome) {
    layoutChrome = settings.layoutChrome;
    const pad = autoLayoutPadding && settings.layoutChrome.autoPadding !== false;
    setChromeVars(layoutChrome, pad);
    emit('chrome', layoutChrome);
  }
  emit('theme', theme);
  emit('language', language);
  emit('region', region);
};

const notifyUrl = (force = false) => {
  const fullPath = location.pathname + location.search + location.hash;
  if (!force && fullPath === path) return;
  path = fullPath;
  post('SHELLUI_URL_CHANGED', {
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
    fullPath,
  });
};

const postUrlParts = (pathname: string, search: string, hash: string) => {
  const fullPath = pathname + search + hash;
  if (fullPath === path) return;
  path = fullPath;
  post('SHELLUI_URL_CHANGED', { pathname, search, hash, fullPath });
};

addEventListener('popstate', () => notifyUrl());
addEventListener('hashchange', () => notifyUrl());
// Embedded: pushState → replaceState so the iframe does not add joint session-history
// entries; the shell mirrors routes and owns back/forward.
const originalPush = history.pushState.bind(history);
const originalReplace = history.replaceState.bind(history);
const embedded = parent !== window;
history.replaceState = function (...args: Parameters<History['replaceState']>) {
  const result = originalReplace(...args);
  notifyUrl();
  return result;
};
history.pushState = function (...args: Parameters<History['pushState']>) {
  const result = embedded ? originalReplace(...args) : originalPush(...args);
  notifyUrl();
  return result;
};

// MPA + same-document hash: report destination URLs (History API alone misses full loads).
document.addEventListener(
  'click',
  (event: MouseEvent) => {
    const link = (event.target as Element | null)?.closest?.('a');
    if (!link?.href) return;
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    if (link.target && link.target !== '' && link.target !== '_self') return;
    try {
      const next = new URL(link.href);
      if (next.origin !== location.origin) return;

      // Do not steal same-document hash clicks — HashRouter SPAs need them. Embedded
      // pushState → replaceState above already avoids joint history for SPA navigations.
      postUrlParts(next.pathname, next.search, next.hash);
    } catch {
      /* ignore invalid hrefs */
    }
  },
  true,
);

addEventListener('message', (event: MessageEvent) => {
  const data = event.data;
  if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
  const type = data.type as string;

  if (type === 'SHELLUI_SETTINGS' || type === 'SHELLUI_SETTINGS_UPDATED') {
    applySettings(data.payload?.settings);
    if (!ready && type === 'SHELLUI_SETTINGS') {
      ready = true;
      post('SHELLUI_INITIALIZED');
      resolveReady();
      emit('ready', api);
    }
  }

  if (type === 'SHELLUI_LAYOUT_CHROME') {
    const next = data.payload?.layoutChrome as LayoutChromeSnapshot | undefined;
    if (next) {
      layoutChrome = next;
      const pad = autoLayoutPadding && next.autoPadding !== false;
      setChromeVars(layoutChrome, pad);
      emit('chrome', layoutChrome);
    }
  }
});

if (embedded) {
  post('SHELLUI_SETTINGS_REQUESTED');
  // Share the current path as soon as the script loads (MPA cold starts / deep links).
  notifyUrl(true);

  let lastY = 0;
  let raf = 0;
  const postScroll = (scrollY: number, distanceFromBottom: number) => {
    const delta = scrollY - lastY;
    lastY = scrollY;
    const direction = Math.abs(delta) < 8 ? 'none' : delta > 0 ? 'down' : 'up';
    post('SHELLUI_CONTENT_SCROLL', { scrollY, direction, distanceFromBottom });
  };
  const readAndPostScroll = (target: EventTarget | null) => {
    let scrollY = 0;
    let distanceFromBottom = 0;
    if (
      target === document ||
      target === document.documentElement ||
      target === document.body ||
      target === null
    ) {
      const el = document.documentElement;
      scrollY = window.scrollY || el.scrollTop || document.body.scrollTop || 0;
      distanceFromBottom = Math.max(0, el.scrollHeight - window.innerHeight - scrollY);
    } else if (target instanceof HTMLElement) {
      scrollY = target.scrollTop;
      distanceFromBottom = Math.max(
        0,
        target.scrollHeight - target.clientHeight - target.scrollTop,
      );
    } else {
      return;
    }
    postScroll(scrollY, distanceFromBottom);
  };
  document.addEventListener(
    'scroll',
    (event: Event) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        readAndPostScroll(event.target);
      });
    },
    { capture: true, passive: true },
  );
  // Initial edge state for host fades / chrome (before any user scroll).
  requestAnimationFrame(() => readAndPostScroll(document));
} else {
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
  get layoutChrome() {
    return layoutChrome;
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
  applyLayoutChrome(options) {
    if (options?.autoPadding === false) autoLayoutPadding = false;
    const pad = options?.autoPadding ?? autoLayoutPadding;
    setChromeVars(layoutChrome, pad !== false);
  },
  reportContentScroll(payload) {
    post('SHELLUI_CONTENT_SCROLL', payload);
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
