# Shellui Nuxt companion

Nuxt starter wired for Shellui via `@shellui/sdk/tiny` (client-only dynamic import).

## Shellui integration

- Handshake: `shellui.ready` in `useShellui`
- Theme: `shellui.applyTheme()` + `shellui.on('theme', …)`
- Language: `shellui.on('language', …)` with `en` / `fr` sample strings

Change theme or language in Shell Settings to see the home page update.

## Scripts

```bash
npm run dev
npm run build
```

Dev server is pinned to port **3000** (`nuxt.config.ts`) so `shellui.config.json` `dev.url` matches.

With Shellui (from the project root after `shellui init nuxt`):

```bash
shellui start
```
