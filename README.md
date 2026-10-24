# Shellui

The opinionated microfrontend shell for building modern web apps.

[![Tests](https://github.com/shellui/shellui/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/shellui/shellui/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/@shellui/cli?label=%40shellui%2Fcli)](https://www.npmjs.com/package/@shellui/cli)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

Shellui gives your app the parts every product rebuilds: navigation, layouts, themes, settings, sign-in, toasts, modals and a desktop build with Tauri. You describe them in one `shellui.config.json`. Your app, in any framework, runs in a frame inside the shell and talks to it through the SDK.

This monorepo holds the three npm packages:

| Package                          | What it does                                           |
| -------------------------------- | ------------------------------------------------------ |
| [`@shellui/cli`](packages/cli)   | `shellui init`, `start`, `build`, `login` and `deploy` |
| [`@shellui/core`](packages/core) | The React shell runtime                                |
| [`@shellui/sdk`](packages/sdk)   | The client your app uses to talk to the shell          |

## Get started

You need Node.js 18 or later.

```bash
npm install -g @shellui/cli
mkdir my-app && cd my-app
shellui init react
shellui start
```

`shellui init` writes `shellui.config.json` and a companion app. `shellui start` runs both on [http://localhost:4000](http://localhost:4000). `shellui build` writes a static shell to `dist/web/`, and `shellui deploy` publishes it to [hosting-service](https://github.com/shellui/hosting-service).

The `latest` npm tag is the stable release. The `alpha` tag (`npm install -g @shellui/cli@alpha`) brings the multi-region setup and needs identity-service 0.9.0 or later.

Try it first in the [playground](https://playground.shellui.com).

## Documentation

Everything is at [docs.shellui.com](https://docs.shellui.com).

- [Install the CLI](https://docs.shellui.com/installation/) and [create a project](https://docs.shellui.com/quickstart/)
- [CLI reference](https://docs.shellui.com/cli/) and [SDK reference](https://docs.shellui.com/sdk/)
- [Desktop apps with Tauri](https://docs.shellui.com/tauri/)
- Services: [identity](https://docs.shellui.com/identity), [storage](https://docs.shellui.com/storage), [hosting](https://docs.shellui.com/hosting) and [email](https://docs.shellui.com/email)

The docs source is in [`docs/`](docs/index.md). The site also pulls each service handbook from its own repo, see [Build the docs site](docs/docs-site.md).

## Use it with a coding agent

Install the official skill so your agent knows the config, the CLI and the SDK:

```bash
npx skills add shellui/skills --skill shellui
```

Agents can also start from [shellui.ai](https://shellui.ai). See [shellui/skills](https://github.com/shellui/skills).

## Development

You need [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm start        # the shell on http://localhost:4000
pnpm test
pnpm lint
pnpm docs:start   # the docs site
```

The workflow, the scripts and the package layout are in [docs/development.md](docs/development.md). Releases follow [docs/publishing.md](docs/publishing.md) and changes are in [CHANGELOG.md](CHANGELOG.md).

## Contributing

Open an issue or a pull request against `develop`. Coding agents start with [AGENTS.md](AGENTS.md).

## Shellui projects

| Project                                                         | What it does                        |
| --------------------------------------------------------------- | ----------------------------------- |
| [shellui](https://github.com/shellui/shellui)                   | The shell, CLI and SDK              |
| [admin](https://github.com/shellui/admin)                       | Administration app inside the shell |
| [files](https://github.com/shellui/files)                       | File explorer for storage-service   |
| [identity-service](https://github.com/shellui/identity-service) | Sign-in, companies and tokens       |
| [storage-service](https://github.com/shellui/storage-service)   | File storage                        |
| [hosting-service](https://github.com/shellui/hosting-service)   | Deploys and serves Shellui apps     |
| [email-service](https://github.com/shellui/email-service)       | Templates and sends email           |
| [skills](https://github.com/shellui/skills)                     | Agent Skills for coding agents      |
| [playground](https://github.com/shellui/playground)             | Live demo of the shell              |

## License

MIT
