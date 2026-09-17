# Shellui Alpine.js starter

Default Vite + Alpine.js starter, embedded in the Shellui shell. `src/main.js` starts Alpine and does a light `@shellui/sdk/tiny` `shellui.ready` handshake (no-op standalone). Edit `index.html` to build your app.

**Boilerplate:** [Vite vanilla](https://vite.dev/guide/#scaffolding-your-first-vite-project) + [official Alpine npm module init](https://alpinejs.dev/essentials/installation):

```js
import Alpine from 'alpinejs';
window.Alpine = Alpine;
Alpine.start();
```

## Scripts

```bash
npm run dev      # Vite dev server on http://localhost:5173 (strictPort)
npm run build    # shellui build (shell → dist/web) then vite build (app → dist/web/app)
npm run preview
```

## With Shellui

From the project root after `shellui init alpine`:

```bash
shellui start    # runs the shell (:4000) + this companion (:5173)
shellui deploy   # uploads dist/web to a Shellui hosting preview
```

`SHELLUI_APP_URL` (see `.env.example`) sets where the built companion is served (default `/app`).
