# Shellui Alpine.js starter

Vite + Alpine.js companion app for [Shellui](https://shellui.com).

**Boilerplate:** [Vite vanilla](https://vite.dev/guide/#scaffolding-your-first-vite-project) + [official Alpine npm module init](https://alpinejs.dev/essentials/installation) —

```js
import Alpine from 'alpinejs';
window.Alpine = Alpine;
Alpine.start();
```

Community starters ([create-alpine-app](https://github.com/thedevdojo/create-alpine-app), Vite+Alpine sketches like dvd101x/vite-alpine) were reviewed; this template stays lean (no Tailwind) and adds Shellui SDK theme + en/fr i18n.

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
