# Shellui SvelteKit companion

SvelteKit starter wired for Shellui via `@shellui/sdk/tiny` (client-only dynamic import for SSR safety).

## Shellui integration

- Handshake: `shellui.ready` in `src/lib/shellui.js`
- Theme: `shellui.applyTheme()` + `shellui.on('theme', …)`
- Language: `shellui.on('language', …)` with `en` / `fr` sample strings (Svelte stores)

Change theme or language in Shell Settings to see the home page update.

## Scripts

```bash
npm run dev
npm run build
```

With Shellui (from the project root after `shellui init svelte`):

```bash
shellui start
```
