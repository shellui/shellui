# Shellui SvelteKit companion

Default SvelteKit starter, embedded in the Shellui shell. `src/routes/+layout.svelte` does a client-only `@shellui/sdk/tiny` `shellui.ready` handshake (SSR-safe). Edit `src/routes/+page.svelte` to build your app.

Built as a static site (`@sveltejs/adapter-static`) so it deploys with the shell.

## Scripts

```bash
npm run dev      # Vite dev server on http://localhost:5173 (strictPort)
npm run build    # shellui build + vite build (static) → dist/web/app
npm run serve:dist  # serve dist/web on http://localhost:8000 (404.html SPA fallback)
npm run preview
```

## With Shellui

From the project root after `shellui init svelte`:

```bash
shellui start    # runs the shell (:4000) + this companion (:5173)
shellui deploy   # uploads dist/web to a Shellui hosting preview
```

`SHELLUI_APP_URL` (see `.env.example`) and the SvelteKit `paths.base` set where the built companion is served (default `/app`). `shellui build` applies that default automatically. After `pnpm build`, run `pnpm run serve:dist` to preview `dist/web` locally (unknown routes fall back to `404.html`).
