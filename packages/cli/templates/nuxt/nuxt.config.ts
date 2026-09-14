// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // Stable companion URL for Shellui iframe embedding.
  devServer: {
    port: 3000,
    host: 'localhost',
  },
});
