import crypto from 'crypto';

/** Inline theme bootstrap in packages/core/src/index.html (must stay in sync). */
export const SHELL_THEME_INIT_SCRIPT = `      // Initialize theme immediately to prevent FOUC
      // This sets both the dark class AND CSS variables before React loads
      (function () {
        try {
          const stored = localStorage.getItem('shellui:settings');
          let theme = 'system';
          let themeName = 'default';
          if (stored) {
            const parsed = JSON.parse(stored);
            theme = parsed.appearance?.theme || 'system';
            themeName = parsed.appearance?.themeName || 'default';
          }

          // Determine if dark mode
          let isDark = false;
          if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            isDark = mediaQuery.matches;
          } else {
            isDark = theme === 'dark';
          }

          // Apply dark class
          if (isDark) {
            document.documentElement.classList.add('dark');
          }

          // Set default theme CSS variables immediately
          // This ensures bg-primary works from the start
          // These HSL values match the default theme in themes.ts
          const root = document.documentElement;

          if (isDark) {
            // Dark mode default theme colors
            root.style.setProperty('--primary', '142 71% 55%');
            root.style.setProperty('--primary-foreground', '0 0% 100%');
            root.style.setProperty('--background', '222.2 84% 4.9%');
            root.style.setProperty('--foreground', '210 40% 98%');
          } else {
            // Light mode default theme colors
            root.style.setProperty('--primary', '142 71% 45%');
            root.style.setProperty('--primary-foreground', '0 0% 100%');
            root.style.setProperty('--background', '0 0% 100%');
            root.style.setProperty('--foreground', '222.2 84% 4.9%');
          }

          // Set other essential variables with defaults
          root.style.setProperty('--card', isDark ? '222.2 84% 4.9%' : '0 0% 100%');
          root.style.setProperty('--card-foreground', isDark ? '210 40% 98%' : '222.2 84% 4.9%');
          root.style.setProperty('--secondary', isDark ? '217.2 32.6% 17.5%' : '210 40% 96.1%');
          root.style.setProperty('--muted', isDark ? '217.2 32.6% 17.5%' : '210 40% 96.1%');
          root.style.setProperty('--border', isDark ? '217.2 32.6% 17.5%' : '214.3 31.8% 91.4%');
          root.style.setProperty('--input', isDark ? '217.2 32.6% 17.5%' : '214.3 31.8% 91.4%');
          root.style.setProperty('--ring', isDark ? '212.7 26.8% 83.9%' : '222.2 84% 4.9%');
          root.style.setProperty('--radius', '0.5rem');
        } catch (e) {
          // Ignore errors
          console.error('[Theme Init] Error:', e);
        }
      })();`;

/** SHA-256 hash source for production CSP (`script-src 'sha256-…'`). */
export function computeThemeInitScriptHash() {
  const digest = crypto
    .createHash('sha256')
    .update(SHELL_THEME_INIT_SCRIPT, 'utf8')
    .digest('base64');
  return `'sha256-${digest}'`;
}

/**
 * connect-src hosts used by `@mlc-ai/web-llm` 0.2.x + local Ollama.
 * Documented for operators enabling enforce mode later.
 */
export const AI_CSP_CONNECT_SRC = [
  // Ollama soft probe / generate (any local port)
  'http://127.0.0.1:*',
  'http://localhost:*',
  // Hugging Face model weights (WebLLM prebuiltAppConfig)
  'https://huggingface.co',
  'https://*.huggingface.co',
  // HF CDN / Xet bridge hosts used for large LFS blobs
  'https://hf.co',
  'https://*.hf.co',
  // WebLLM wasm / binary libs
  'https://raw.githubusercontent.com',
];

/**
 * Build shell CSP suitable for dev/playground (permissive frame/connect for localhost companions).
 * @param {object} opts
 * @param {string} [opts.nonce] - Per-request nonce for inline scripts (dev).
 * @param {boolean} [opts.useScriptHash] - Use build-time hash instead of nonce (production).
 * @param {string} [opts.backendUrl]
 * @param {string[]} [opts.connectSrc]
 * @param {string[]} [opts.frameSrc]
 * @param {string} [opts.reportUri]
 * @param {boolean} [opts.aiEnabled] - Widen CSP for WebLLM / Ollama when on-device AI is enabled.
 */
export function buildShellContentSecurityPolicy(opts = {}) {
  const scriptParts = ["'self'"];
  if (opts.nonce) {
    scriptParts.push(`'nonce-${opts.nonce}'`);
  }
  if (opts.useScriptHash) {
    scriptParts.push(computeThemeInitScriptHash());
  }
  if (opts.aiEnabled) {
    // Chromium requires this for WebAssembly used by WebLLM.
    scriptParts.push("'wasm-unsafe-eval'");
  }

  const connectParts = ["'self'", 'ws:', 'wss:'];
  if (opts.backendUrl) {
    try {
      connectParts.push(new URL(opts.backendUrl).origin);
    } catch {
      // ignore invalid backend url
    }
  }
  if (opts.aiEnabled) {
    for (const extra of AI_CSP_CONNECT_SRC) {
      connectParts.push(extra);
    }
  }
  for (const extra of opts.connectSrc ?? []) {
    if (extra) connectParts.push(extra);
  }

  const frameParts = ["'self'", 'http://localhost:*', 'http://127.0.0.1:*', 'https:'];
  for (const extra of opts.frameSrc ?? []) {
    if (extra) frameParts.push(extra);
  }

  const directives = [
    "default-src 'self'",
    `script-src ${scriptParts.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectParts.join(' ')}`,
    `frame-src ${frameParts.join(' ')}`,
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];

  if (opts.aiEnabled) {
    // Module workers (WebLLM) + blob: workers Vite may emit.
    directives.push("worker-src 'self' blob:");
  }

  if (opts.reportUri) {
    directives.push(`report-uri ${opts.reportUri}`);
  }

  return directives.join('; ');
}

/**
 * Resolve CSP header names/values from shellui config.
 * Default: report-only (staged rollout).
 * @param {object} shelluiConfig
 * @param {object} cspOpts - passed to buildShellContentSecurityPolicy
 */
export function resolveShellCspHeaders(shelluiConfig, cspOpts = {}) {
  const cspConfig = shelluiConfig?.security?.csp ?? {};
  const enforce = cspConfig.enforce === true;
  const reportOnly = cspConfig.reportOnly !== false && !enforce;
  const aiEnabled =
    cspOpts.aiEnabled !== undefined
      ? Boolean(cspOpts.aiEnabled)
      : shelluiConfig?.ai?.enabled !== false;

  const policy = buildShellContentSecurityPolicy({
    useScriptHash: cspOpts.useScriptHash,
    nonce: cspOpts.nonce,
    backendUrl: cspOpts.backendUrl ?? shelluiConfig?.backend?.url,
    connectSrc: cspOpts.connectSrc ?? cspConfig.connectSrc,
    frameSrc: cspOpts.frameSrc ?? cspConfig.frameSrc,
    reportUri: cspOpts.reportUri ?? cspConfig.reportUri,
    aiEnabled,
  });

  const headers = {};
  if (enforce) {
    headers['Content-Security-Policy'] = policy;
  }
  if (reportOnly) {
    headers['Content-Security-Policy-Report-Only'] = policy;
  }
  return headers;
}
