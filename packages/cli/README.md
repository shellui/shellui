# @shellui/cli

Command-line tool for Shellui. Install it, then run `shellui` to create a project, start the host, and build.

## Installation

```bash
npm install -g @shellui/cli
```

Or as a project dev dependency:

```bash
npm install --save-dev @shellui/cli
```

## Usage

```bash
shellui init
shellui init react
shellui start
shellui start --host
shellui start --app
shellui start --run vite --follow http://localhost:5173
shellui start --shell-only
shellui build
shellui build --app
shellui build --app --bundles app,dmg
shellui config migrate
shellui config split
shellui config unsplit
shellui login
shellui logout
shellui whoami
shellui deploy
shellui start --config ./config
```

`dev` is an alias for `start`. `--shell-only` ignores `config.dev.run`. Do not pass `--no-run`.

**init frameworks:** `empty`, `react`, `vue`, `angular`, `next`, `nuxt`, `svelte`, `alpine`.

Full command and config reference: [CLI docs](https://docs.shellui.com/cli). Desktop: [Tauri / desktop app](https://docs.shellui.com/tauri). `shellui start` / `build` ignore the project `vite.config`, PostCSS, Tailwind, `tsconfig`, and `VITE_*` - see [tooling isolation](https://docs.shellui.com/cli#tooling-isolation).

## Project structure (this package)

```text
src/
├── cli.js
├── commands/
└── utils/
```

Adding a command: implement it under `src/commands/`, export from `src/commands/index.js`, register it in `src/cli.js`. See `src/commands/README.md`.

## License

MIT
