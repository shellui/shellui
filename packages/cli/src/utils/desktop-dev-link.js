/**
 * Desktop sign-in during `shellui start --app`.
 *
 * The dev shell signs in with `<auth.desktopScheme>-dev` so it never takes
 * links meant for an installed build. `tauri dev` gets that scheme as its
 * only deep-link scheme. On Windows and Linux the app registers it at runtime
 * (`register_all`) and the single-instance plugin forwards the link.
 *
 * macOS cannot register a scheme for an unbundled binary. There a small
 * applet registered for the `-dev` scheme forwards the link to the shell dev
 * server, which hands it to the webview over the Vite HMR socket. The webview
 * re-emits it as the Tauri deep-link plugin event the shell already listens for.
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import pc from 'picocolors';

export const DESKTOP_DEV_SCHEME_ENV = 'SHELLUI_DESKTOP_DEV_SCHEME';
export const DESKTOP_DEV_LINK_TOKEN_ENV = 'SHELLUI_DESKTOP_DEV_LINK_TOKEN';
export const DESKTOP_DEV_LINK_PATH = '/__shellui/desktop-dev-link';
export const DESKTOP_DEV_LINK_HEADER = 'x-shellui-dev-link';
export const DESKTOP_DEV_LINK_EVENT = 'shellui:desktop-dev-link';

export const DESKTOP_DEV_LINK_SCHEME_SUFFIX = '-dev';

const DEEP_LINK_EVENT = 'deep-link://new-url';
const VIRTUAL_CLIENT_ID = 'virtual:shellui-desktop-dev-link';
const RESOLVED_CLIENT_ID = `\0${VIRTUAL_CLIENT_ID}`;
const MAX_BODY_BYTES = 8 * 1024;

const LSREGISTER =
  '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*$/;
const REFUSED_SCHEMES = new Set([
  'http',
  'https',
  'javascript',
  'data',
  'file',
  'vbscript',
  'about',
  'blob',
  'ftp',
  'mailto',
  'ws',
  'wss',
]);

/**
 * Desktop sign-in scheme from shellui config, or null when desktop sign-in is off.
 * Mirrors `normalizeDesktopScheme` in @shellui/core.
 * @param {object | null | undefined} config
 * @returns {string | null}
 */
export function resolveDesktopDevLinkScheme(config) {
  if (config?.backend?.type !== 'shellui') return null;
  const raw = config?.auth?.desktopScheme;
  if (typeof raw !== 'string') return null;
  const scheme = raw.trim();
  if (!scheme || scheme !== scheme.toLowerCase()) return null;
  if (!SCHEME_PATTERN.test(scheme) || REFUSED_SCHEMES.has(scheme)) return null;
  return scheme;
}

/**
 * Dev scheme for a desktop sign-in scheme: `shellui-playground` → `shellui-playground-dev`.
 * @param {string} scheme
 * @returns {string}
 */
export function toDesktopDevLinkScheme(scheme) {
  return `${scheme}${DESKTOP_DEV_LINK_SCHEME_SUFFIX}`;
}

/**
 * Config the dev shell serves under `shellui start --app`: `auth.desktopScheme`
 * becomes the `-dev` scheme. Returns the config unchanged otherwise.
 * @template {object} T
 * @param {T} config
 * @param {string | undefined} [devScheme]
 * @returns {T}
 */
export function applyDesktopDevLinkScheme(config, devScheme = process.env[DESKTOP_DEV_SCHEME_ENV]) {
  const scheme = resolveDesktopDevLinkScheme(config);
  if (!devScheme || !scheme) return config;
  return { ...config, auth: { ...config.auth, desktopScheme: toDesktopDevLinkScheme(scheme) } };
}

/**
 * `tauri dev --config` patch: the dev app handles only the `-dev` scheme.
 * @param {string} devScheme
 * @returns {string}
 */
export function buildDevDeepLinkConfigPatch(devScheme) {
  return JSON.stringify({ plugins: { 'deep-link': { desktop: { schemes: [devScheme] } } } });
}

/**
 * Escape a value for an AppleScript string literal.
 * @param {string} value
 * @returns {string}
 */
function appleScriptString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * AppleScript for the forwarding applet.
 * @param {{ port: number; token: string }} options
 * @returns {string}
 */
export function buildDevLinkAppleScript({ port, token }) {
  const endpoint = `http://localhost:${port}${DESKTOP_DEV_LINK_PATH}`;
  return [
    'on open location theURL',
    '  try',
    `    do shell script "/usr/bin/curl -fsS -m 5 -X POST -H " & quoted form of ${appleScriptString(`${DESKTOP_DEV_LINK_HEADER}: ${token}`)} & " --data-raw " & quoted form of theURL & " " & quoted form of ${appleScriptString(endpoint)}`,
    '  on error errMsg',
    `    display alert "Shellui dev sign-in" message ("Could not reach the dev server at " & ${appleScriptString(endpoint)} & ". Is shellui start --app still running?" & return & return & errMsg) as warning`,
    '  end try',
    'end open location',
    '',
  ].join('\n');
}

/**
 * @param {string} command
 * @param {string[]} args
 */
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    throw new Error(`${path.basename(command)} failed${details ? `: ${details}` : ''}`);
  }
}

/**
 * Build and register the forwarding applet with Launch Services.
 * Returns a cleanup function that unregisters and removes it.
 * @param {{
 *   appDir: string;
 *   productName: string;
 *   identifier: string;
 *   scheme: string;
 *   port: number;
 *   token: string;
 * }} options
 * @returns {() => void}
 */
export function registerDesktopDevLink({ appDir, productName, identifier, scheme, port, token }) {
  const linkDir = path.join(appDir, 'dev-link');
  const appPath = path.join(linkDir, `${productName} Dev Link.app`);
  fs.rmSync(linkDir, { recursive: true, force: true });
  fs.mkdirSync(linkDir, { recursive: true });

  const scriptPath = path.join(os.tmpdir(), `shellui-dev-link-${process.pid}.applescript`);
  fs.writeFileSync(scriptPath, buildDevLinkAppleScript({ port, token }), { mode: 0o600 });
  try {
    run('/usr/bin/osacompile', ['-o', appPath, scriptPath]);
  } finally {
    fs.rmSync(scriptPath, { force: true });
  }

  const plist = path.join(appPath, 'Contents', 'Info.plist');
  const urlTypes = [{ CFBundleURLName: identifier, CFBundleURLSchemes: [scheme] }];
  run('/usr/bin/plutil', [
    '-replace',
    'CFBundleIdentifier',
    '-string',
    `${identifier}.devlink`,
    plist,
  ]);
  run('/usr/bin/plutil', ['-replace', 'CFBundleName', '-string', `${productName} Dev Link`, plist]);
  run('/usr/bin/plutil', ['-replace', 'LSUIElement', '-bool', 'YES', plist]);
  run('/usr/bin/plutil', [
    '-replace',
    'CFBundleURLTypes',
    '-json',
    JSON.stringify(urlTypes),
    plist,
  ]);
  // Editing Info.plist breaks the applet's signature. Re-sign ad hoc so it launches.
  run('/usr/bin/codesign', ['--force', '--sign', '-', appPath]);
  run(LSREGISTER, ['-f', appPath]);

  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    spawnSync(LSREGISTER, ['-u', appPath]);
    fs.rmSync(linkDir, { recursive: true, force: true });
  };
}

/**
 * Switch `shellui start --app` to the `-dev` desktop scheme, and on macOS register
 * the forwarding applet. Sets env vars the `shellui start` hook inherits.
 * Returns null when the project does not use desktop sign-in.
 * @param {{
 *   appDir: string;
 *   config: object;
 *   tauriConf: { productName?: string; identifier?: string };
 *   platform?: NodeJS.Platform;
 * }} options
 * @returns {{ scheme: string; cleanup: (() => void) | null } | null}
 */
export function setupDesktopDevLink({ appDir, config, tauriConf, platform = process.platform }) {
  const baseScheme = resolveDesktopDevLinkScheme(config);
  if (!baseScheme) return null;
  const scheme = toDesktopDevLinkScheme(baseScheme);
  process.env[DESKTOP_DEV_SCHEME_ENV] = scheme;
  console.log(pc.green(`Desktop sign-in: dev uses ${scheme}://`));
  console.log(
    pc.dim(
      `  identity-service accepts it when ${baseScheme} is registered. If sign-in reports an unregistered scheme, update identity-service or add ${scheme} in Shellui admin.`,
    ),
  );

  if (platform !== 'darwin') return { scheme, cleanup: null };

  const token = crypto.randomBytes(24).toString('hex');
  const port = config.port ?? 3000;
  try {
    const cleanup = registerDesktopDevLink({
      appDir,
      productName: tauriConf.productName || 'Shellui',
      identifier: tauriConf.identifier || 'com.shellui.app',
      scheme,
      port,
      token,
    });
    process.env[DESKTOP_DEV_LINK_TOKEN_ENV] = token;
    return { scheme, cleanup };
  } catch (error) {
    console.warn(
      pc.yellow(
        `Desktop sign-in: could not register ${scheme}:// for dev (${error.message}). ` +
          'Sign-in links will not return to the app. Use shellui build --app to test sign-in.',
      ),
    );
    return { scheme, cleanup: null };
  }
}

/**
 * @param {string | undefined} remoteAddress
 * @returns {boolean}
 */
function isLoopbackAddress(remoteAddress) {
  return (
    remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1'
  );
}

/**
 * @param {unknown} received
 * @param {string} expected
 * @returns {boolean}
 */
function tokenMatches(received, expected) {
  if (typeof received !== 'string') return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<string | null>} null when the body is too large
 */
function readSmallBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const CLIENT_SOURCE = `
if (import.meta.hot && window.parent === window) {
  import.meta.hot.on(${JSON.stringify(DESKTOP_DEV_LINK_EVENT)}, (data) => {
    const internals = window.__TAURI_INTERNALS__;
    if (!internals || typeof internals.invoke !== 'function') return;
    if (!data || typeof data.url !== 'string') return;
    internals
      .invoke('plugin:event|emit', { event: ${JSON.stringify(DEEP_LINK_EVENT)}, payload: [data.url] })
      .catch(() => {});
  });
}
`;

/**
 * Dev server half of the macOS desktop dev link. Inert unless
 * `shellui start --app` set the token for this run.
 * @param {object} shelluiConfig config after `applyDesktopDevLinkScheme`
 * @param {string | undefined} [token]
 * @returns {import('vite').Plugin | null}
 */
export function desktopDevLinkPlugin(
  shelluiConfig,
  token = process.env[DESKTOP_DEV_LINK_TOKEN_ENV],
) {
  const scheme = resolveDesktopDevLinkScheme(shelluiConfig);
  if (!token || !scheme) return null;

  return {
    name: 'shellui-desktop-dev-link',
    apply: 'serve',
    resolveId(id) {
      return id === VIRTUAL_CLIENT_ID ? RESOLVED_CLIENT_ID : undefined;
    },
    load(id) {
      return id === RESOLVED_CLIENT_ID ? CLIENT_SOURCE : undefined;
    },
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { type: 'module', src: `/@id/${VIRTUAL_CLIENT_ID}` },
          injectTo: 'head',
        },
      ];
    },
    configureServer(server) {
      server.middlewares.use(DESKTOP_DEV_LINK_PATH, async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        if (
          !isLoopbackAddress(req.socket.remoteAddress) ||
          !tokenMatches(req.headers[DESKTOP_DEV_LINK_HEADER], token)
        ) {
          res.statusCode = 403;
          res.end();
          return;
        }
        const body = await readSmallBody(req).catch(() => null);
        const url = body?.trim();
        if (!url || !url.startsWith(`${scheme}:`)) {
          res.statusCode = 400;
          res.end();
          return;
        }
        server.ws.send({ type: 'custom', event: DESKTOP_DEV_LINK_EVENT, data: { url } });
        console.log(pc.dim(`Desktop sign-in: forwarded a ${scheme}:// link to the dev window`));
        res.statusCode = 204;
        res.end();
      });
    },
  };
}
