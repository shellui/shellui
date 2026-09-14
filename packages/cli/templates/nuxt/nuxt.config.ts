// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // Stable companion URL for Shellui iframe embedding — must match shellui.config.json
  // `dev.url` (http://localhost:3000). vite.server.strictPort fails if 3000 is busy
  // instead of silently hopping (which would break waitForUrl).
  //
  // Shellui embeds this app in an iframe from the shell origin (default
  // http://localhost:4000). routeRules CSP allows that for local/prod-preview
  // embeds; tighten frame-ancestors for real deployed origins as needed.
  devServer: {
    port: 3000,
    host: 'localhost',
  },
  vite: {
    server: {
      strictPort: true,
    },
  },
  nitro: {
    routeRules: {
      '/**': {
        headers: {
          'Content-Security-Policy':
            "frame-ancestors 'self' http://localhost:4000 http://127.0.0.1:4000",
        },
      },
    },
  },
});
