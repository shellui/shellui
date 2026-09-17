# Shellui Angular companion

Default Angular starter, embedded in the Shellui shell. `src/main.ts` does a light `@shellui/sdk/tiny` `shellui.ready` handshake (no-op standalone). Edit `src/app/app.component.*` to build your app.

## Scripts

```bash
npm run dev      # ng serve on http://localhost:4200
npm run build    # shellui build + ng build → dist/web/app (browser output flattened)
npm run serve:dist  # serve dist/web on http://localhost:8000 (404.html SPA fallback)
```

## With Shellui

From the project root after `shellui init angular`:

```bash
shellui start    # runs the shell (:4000) + this companion (:4200)
shellui deploy   # uploads dist/web to a Shellui hosting preview
```

`SHELLUI_APP_URL` (see `.env.example`) and the production `baseHref` set where the built companion is served (default `/app`). `shellui build` applies that default automatically. After `pnpm build`, run `pnpm run serve:dist` to preview `dist/web` locally (unknown routes fall back to `404.html`).
