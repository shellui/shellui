# Shellui Angular companion

Angular starter wired for Shellui via `@shellui/sdk/tiny`.

## Shellui integration

- Handshake: `shellui.ready` (via `ShelluiService`)
- Theme: `shellui.applyTheme()` + `shellui.on('theme', …)`
- Language: `shellui.on('language', …)` with inline `en` / `fr` sample strings

Change theme or language in Shell Settings to see the home page update.

## Scripts

```bash
npm run dev
npm run build
```

With Shellui (from the project root after `shellui init angular`):

```bash
shellui start
```
