import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { EventEmitter } from 'events';
import {
  DESKTOP_DEV_LINK_EVENT,
  DESKTOP_DEV_LINK_HEADER,
  DESKTOP_DEV_LINK_PATH,
  DESKTOP_DEV_LINK_TOKEN_ENV,
  DESKTOP_DEV_SCHEME_ENV,
  applyDesktopDevLinkScheme,
  buildDevDeepLinkConfigPatch,
  buildDevLinkAppleScript,
  desktopDevLinkPlugin,
  resolveDesktopDevLinkScheme,
  setupDesktopDevLink,
  toDesktopDevLinkScheme,
} from '../desktop-dev-link.js';

const TOKEN = 'a'.repeat(48);
const config = {
  backend: { type: 'shellui', url: 'https://id.example.com' },
  auth: { desktopScheme: 'shellui-playground' },
};

function mountMiddleware(plugin) {
  let handler;
  const server = {
    middlewares: {
      use: (route, fn) => {
        expect(route).toBe(DESKTOP_DEV_LINK_PATH);
        handler = fn;
      },
    },
    ws: { send: vi.fn() },
  };
  plugin.configureServer(server);
  return { server, handler };
}

async function post(
  handler,
  { body = '', headers = {}, remoteAddress = '127.0.0.1', method = 'POST' },
) {
  const req = new EventEmitter();
  req.method = method;
  req.headers = headers;
  req.socket = { remoteAddress };
  req.destroy = () => {};
  const res = { statusCode: 200, end: vi.fn() };
  const done = handler(req, res);
  req.emit('data', Buffer.from(body));
  req.emit('end');
  await done;
  return res;
}

describe('resolveDesktopDevLinkScheme', () => {
  test('returns the scheme for a shellui backend', () => {
    expect(resolveDesktopDevLinkScheme(config)).toBe('shellui-playground');
  });

  test('ignores other backends and invalid schemes', () => {
    expect(resolveDesktopDevLinkScheme({ ...config, backend: { type: 'supabase' } })).toBeNull();
    expect(resolveDesktopDevLinkScheme({ ...config, auth: { desktopScheme: 'https' } })).toBeNull();
    expect(
      resolveDesktopDevLinkScheme({ ...config, auth: { desktopScheme: 'Shellui' } }),
    ).toBeNull();
    expect(resolveDesktopDevLinkScheme({ ...config, auth: {} })).toBeNull();
  });
});

describe('applyDesktopDevLinkScheme', () => {
  const DEV = 'shellui-playground-dev';

  test('serves the -dev scheme under shellui start --app', () => {
    const next = applyDesktopDevLinkScheme(config, DEV);
    expect(toDesktopDevLinkScheme('shellui-playground')).toBe(DEV);
    expect(next.auth.desktopScheme).toBe(DEV);
    expect(next.backend).toBe(config.backend);
    expect(config.auth.desktopScheme).toBe('shellui-playground');
  });

  test('keeps the config as is outside app dev or without a desktop scheme', () => {
    expect(applyDesktopDevLinkScheme(config, undefined)).toBe(config);
    const noScheme = { ...config, auth: {} };
    expect(applyDesktopDevLinkScheme(noScheme, DEV)).toBe(noScheme);
  });
});

describe('buildDevDeepLinkConfigPatch', () => {
  test('gives tauri dev only the -dev scheme', () => {
    expect(JSON.parse(buildDevDeepLinkConfigPatch('shellui-playground-dev'))).toEqual({
      plugins: { 'deep-link': { desktop: { schemes: ['shellui-playground-dev'] } } },
    });
  });
});

describe('buildDevLinkAppleScript', () => {
  test('forwards the opened URL to the dev server with the token', () => {
    const script = buildDevLinkAppleScript({ port: 4000, token: TOKEN });
    expect(script).toContain('on open location theURL');
    expect(script).toContain(`http://localhost:4000${DESKTOP_DEV_LINK_PATH}`);
    expect(script).toContain(`${DESKTOP_DEV_LINK_HEADER}: ${TOKEN}`);
    expect(script).toContain('quoted form of theURL');
  });
});

describe('setupDesktopDevLink', () => {
  const saved = {};

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    for (const key of [DESKTOP_DEV_SCHEME_ENV, DESKTOP_DEV_LINK_TOKEN_ENV]) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test('uses the -dev scheme on Linux and Windows without an applet', () => {
    for (const platform of ['linux', 'win32']) {
      const result = setupDesktopDevLink({ appDir: '/tmp/x', config, tauriConf: {}, platform });
      expect(result).toEqual({ scheme: 'shellui-playground-dev', cleanup: null });
      expect(process.env[DESKTOP_DEV_SCHEME_ENV]).toBe('shellui-playground-dev');
      expect(process.env[DESKTOP_DEV_LINK_TOKEN_ENV]).toBeUndefined();
    }
  });

  test('does nothing without desktop sign-in', () => {
    const result = setupDesktopDevLink({
      appDir: '/tmp/x',
      config: { ...config, auth: {} },
      tauriConf: {},
      platform: 'linux',
    });
    expect(result).toBeNull();
    expect(process.env[DESKTOP_DEV_SCHEME_ENV]).toBeUndefined();
  });
});

describe('desktopDevLinkPlugin', () => {
  test('is off without a token or a desktop scheme', () => {
    expect(desktopDevLinkPlugin(config, undefined)).toBeNull();
    expect(desktopDevLinkPlugin({ ...config, auth: {} }, TOKEN)).toBeNull();
  });

  test('injects the client script into the shell page', () => {
    const plugin = desktopDevLinkPlugin(config, TOKEN);
    const [tag] = plugin.transformIndexHtml();
    expect(tag.attrs.src).toBe('/@id/virtual:shellui-desktop-dev-link');
    const resolved = plugin.resolveId('virtual:shellui-desktop-dev-link');
    expect(plugin.load(resolved)).toContain('deep-link://new-url');
  });

  test('forwards a link with the right token to the webview', async () => {
    const { server, handler } = mountMiddleware(desktopDevLinkPlugin(config, TOKEN));
    const url = 'shellui-playground://callback?shellui_auth_code=abc';
    const res = await post(handler, { body: url, headers: { [DESKTOP_DEV_LINK_HEADER]: TOKEN } });
    expect(res.statusCode).toBe(204);
    expect(server.ws.send).toHaveBeenCalledWith({
      type: 'custom',
      event: DESKTOP_DEV_LINK_EVENT,
      data: { url },
    });
  });

  test('refuses a wrong token, a remote caller, or another scheme', async () => {
    const { server, handler } = mountMiddleware(desktopDevLinkPlugin(config, TOKEN));
    const url = 'shellui-playground://callback?shellui_auth_code=abc';
    const headers = { [DESKTOP_DEV_LINK_HEADER]: TOKEN };

    expect(
      (await post(handler, { body: url, headers: { [DESKTOP_DEV_LINK_HEADER]: 'b'.repeat(48) } }))
        .statusCode,
    ).toBe(403);
    expect(
      (await post(handler, { body: url, headers, remoteAddress: '10.0.0.2' })).statusCode,
    ).toBe(403);
    expect((await post(handler, { body: 'other-app://callback?code=1', headers })).statusCode).toBe(
      400,
    );
    expect((await post(handler, { body: url, headers, method: 'GET' })).statusCode).toBe(405);
    expect(server.ws.send).not.toHaveBeenCalled();
  });
});
