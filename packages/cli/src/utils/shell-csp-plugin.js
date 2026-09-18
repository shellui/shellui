import { resolveShellCspHeaders } from './csp.js';

/**
 * Emit shell CSP headers (report-only by default).
 * Inline theme script is allowed via build-time SHA-256 hash (see csp.js).
 * @param {object} shelluiConfig
 */
export function shellCspPlugin(shelluiConfig) {
  return {
    name: 'shellui-csp',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const headers = resolveShellCspHeaders(shelluiConfig, {
          useScriptHash: true,
        });
        for (const [key, value] of Object.entries(headers)) {
          res.setHeader(key, value);
        }
        next();
      });
    },
  };
}
