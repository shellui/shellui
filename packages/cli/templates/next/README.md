# Shellui Next.js companion

Next.js App Router starter wired for Shellui via `@shellui/sdk/tiny` (client-only dynamic import for SSR safety).

## Shellui integration

- Handshake: `shellui.ready` in `app/home.js`
- Theme: `shellui.applyTheme()` + `shellui.on('theme', …)`
- Language: `shellui.on('language', …)` with `en` / `fr` sample strings

Change theme or language in Shell Settings to see the home page update.

## Scripts

```bash
npm run dev
npm run build
```

Dev is pinned to port **3000** (`scripts/ensure-port.mjs`) so `shellui.config.json` `dev.url` matches.

With Shellui (from the project root after `shellui init next`):

```bash
shellui start
```
