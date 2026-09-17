# Shellui Next.js companion

Default create-next-app (App Router) starter, embedded in the Shellui shell. `app/shellui-client.js` does a client-only `@shellui/sdk/tiny` `shellui.ready` handshake (SSR-safe). Edit `app/page.js` to build your app.

Built as a static export (`output: 'export'`) so it deploys with the shell.

## Scripts

```bash
npm run dev      # next dev pinned to port 3000 (scripts/ensure-port.mjs)
npm run build    # shellui build + next build (static export) → dist/web/app
```

Dev is pinned to port **3000** so `shellui.config.json` `dev.url` matches.

## With Shellui

From the project root after `shellui init next`:

```bash
shellui start    # runs the shell (:4000) + this companion (:3000)
shellui deploy   # uploads dist/web to a Shellui hosting preview
```

`SHELLUI_APP_URL` (see `.env.example`) and `basePath` set where the built companion is served (default `/app`).
