# Shellui Vue companion

Default Vite + Vue starter, embedded in the Shellui shell. `src/main.js` does a light `@shellui/sdk/tiny` `shellui.ready` handshake (no-op standalone). Edit `src/App.vue` / `src/components/HelloWorld.vue` to build your app.

## Scripts

```bash
npm run dev      # Vite dev server on http://localhost:5173 (strictPort)
npm run build    # shellui build (shell → dist/web) then vite build (app → dist/web/app)
npm run serve:dist  # serve dist/web on http://localhost:8000 (404.html SPA fallback)
npm run preview
```

## With Shellui

From the project root after `shellui init vue`:

```bash
shellui start    # runs the shell (:4000) + this companion (:5173)
shellui deploy   # uploads dist/web to a Shellui hosting preview
```

`SHELLUI_APP_URL` (see `.env.example`) sets where the built companion is served (default `/app`). `shellui build` applies that default automatically; override with a project `.env` if needed. The shell builds with relative asset paths so a deployed `dist/web` works from any base.

After `pnpm build`, run `pnpm run serve:dist` to preview `dist/web` locally. Unknown routes fall back to `404.html` for shell deep links.
