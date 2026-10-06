---
title: Install the CLI
sidebar_label: Installation
description: 'Install @shellui/cli globally or as a project dependency, then confirm the shellui command.'
---

Install `@shellui/cli` so you can create a project, run the development server, and build a production shell. Node.js 18.0.0 or higher is required. npm ships with Node.js.

## Install globally

Use a global install when you want `shellui` on your PATH from any directory:

```bash
npm install -g @shellui/cli
```

Then run commands directly:

```bash
shellui start
shellui start --host
shellui dev --app
shellui build
shellui build --app
npx shellui build --app --bundles app,dmg
```

`dev` is an alias for `start`. `--host` listens on `0.0.0.0`. `--app` starts or builds the [desktop wrapper](/tauri).

## Install the beta

These docs describe Shellui **0.6.0**, currently published as `0.6.0-beta.1` on the npm `beta` tag. A plain install picks the `latest` tag (0.5.x), which lacks 0.6 features such as [account management](/features/authentication#account-management). Add `@beta` to get the pre-release:

```bash
npm install -g @shellui/cli@beta
npm install --save-dev @shellui/cli@beta
npm install @shellui/sdk@beta
```

See the [changelog](https://github.com/shellui/shellui/blob/main/CHANGELOG.md) for what changed in 0.6.0.

## Install in a project

Add the CLI as a dev dependency when the version should stay with the repo:

```bash
npm install --save-dev @shellui/cli
```

Call it with `npx`:

```bash
npx shellui start
npx shellui build
```

Or add scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "shellui dev",
    "build": "shellui build",
    "dev:app": "shellui dev --app",
    "build:app": "shellui build --app",
    "build:app:dmg": "shellui build --app --bundles app,dmg"
  }
}
```

## Confirm the install

Print the installed version:

```bash
shellui --version
```

If the command is missing, use `npx shellui --version` from a project that lists `@shellui/cli`, or reinstall globally.

## Related packages

The CLI pulls in `@shellui/core` for the React shell. Install these yourself only when you import them from application code:

- `@shellui/core` - config types, `useAuth`, and the runtime the CLI serves
- `@shellui/sdk` - iframe APIs (`init`, toasts, overlays, storage)

Next: [create a project](/quickstart).
