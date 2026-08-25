# CLI

Package: `@shellui/cli` · bin: `shellui` · Node >= 18

| Command                            | Purpose                                               |
| ---------------------------------- | ----------------------------------------------------- |
| `shellui init [root]`              | Create `shellui.config.json` (`--force` to overwrite) |
| `shellui start` / `dev`            | Vite dev server; auto-init if no config               |
| `shellui build`                    | Production build → `dist/`                            |
| `shellui config migrate`           | `shellui.config.ts` → JSON (+ `.bak`)                 |
| `shellui config split` / `unsplit` | Split or merge section config files                   |

## Useful flags

- `--config <path>` — config dir or file (wins over `SHELLUI_CONFIG`)
- `--host` — listen on `0.0.0.0`
- `--app` — desktop (Tauri) path; see https://docs.shellui.com/tauri

## After init

Add `static/` assets (`favicon.svg`, `logo.svg`, `icons/`). Ensure `dist/` is gitignored (init helps).

Docs: https://docs.shellui.com/cli · https://docs.shellui.com/installation
