# Shellui Nuxt companion

Default Nuxt starter, embedded in the Shellui shell. `app/plugins/shellui.client.ts` does a client-only `@shellui/sdk/tiny` `shellui.ready` handshake. Edit `app/app.vue` to build your app.

Built as a static site (`nuxt generate`) so it deploys with the shell.

## Scripts

```bash
npm run dev      # Nuxt dev server pinned to port 3000
npm run build    # shellui build + nuxt generate (static) → dist/web/app
npm run serve:dist  # serve dist/web on http://localhost:8000 (404.html SPA fallback)
npm run preview
```

Dev server is pinned to port **3000** so `shellui.config.json` `dev.url` matches.

## With Shellui

From the project root after `shellui init nuxt`:

```bash
shellui start    # runs the shell (:4000) + this companion (:3000)
shellui deploy   # uploads dist/web to a Shellui hosting preview
```

`SHELLUI_APP_URL` (see `.env.example`) and `app.baseURL` set where the built companion is served (default `/app`). `shellui build` applies that default automatically. After `pnpm build`, run `pnpm run serve:dist` to preview `dist/web` locally (unknown routes fall back to `404.html`).
