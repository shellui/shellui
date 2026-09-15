# Shellui Alpine.js starter

Vite + Alpine.js companion app for [Shellui](https://shellui.com).

Scaffolded from the [official Alpine.js npm install](https://alpinejs.dev/essentials/installation) pattern (`import Alpine from 'alpinejs'` + `Alpine.start()`), bundled with [Vite](https://vite.dev/).

## Scripts

```bash
npm run dev      # http://localhost:5173 (strictPort)
npm run build
npm run preview
```

## Shellui integration

- `@shellui/sdk/tiny` handshake (`shellui.ready`)
- Theme follows the shell via `shellui.applyTheme()` / `shellui.on('theme', …)`
- Language follows the shell (`en` / `fr` sample UI) via `shellui.language` / `shellui.on('language', …)`

When embedded, open Shell Settings to change theme or language and watch this page update.
