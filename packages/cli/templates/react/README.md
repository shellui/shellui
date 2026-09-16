# Shellui React companion

Vite + React starter wired for Shellui via `@shellui/sdk/tiny`.

## Shellui integration

- Handshake: `shellui.ready` (via `useShellui`)
- Theme: `shellui.applyTheme()` + `shellui.on('theme', …)`
- Language: `shellui.on('language', …)` with `en` / `fr` sample strings (i18next)

Change theme or language in Shell Settings to see the home page update.

## Scripts

```bash
npm run dev
npm run build
```

With Shellui (from the project root after `shellui init react`):

```bash
shellui start
```
