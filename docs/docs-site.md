---
title: Build the docs site
sidebar_label: Docs site
description: 'How docs.shellui.com pulls in the identity, storage, hosting, and email service docs at build time, and how to build it locally.'
---

The site at [docs.shellui.com](https://docs.shellui.com) is the Docusaurus site in `tools/docusaurus`. It renders the Shellui docs from `docs/` and the docs of each Shellui service, fetched at build time from the service repositories.

| Service  | Repository                                                              | URL                                                                          |
| -------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Identity | [shellui/identity-service](https://github.com/shellui/identity-service) | [docs.shellui.com/identity](https://docs.shellui.com/identity)               |
| Storage  | [shellui/storage-service](https://github.com/shellui/storage-service)   | [docs.shellui.com/storage](https://docs.shellui.com/storage)                 |
| Hosting  | [shellui/hosting-service](https://github.com/shellui/hosting-service)   | [docs.shellui.com/hosting/actions](https://docs.shellui.com/hosting/actions) |
| Email    | [shellui/email-service](https://github.com/shellui/email-service)       | [docs.shellui.com/email](https://docs.shellui.com/email)                     |

Each service shows up under **Services** in the navbar, with its own sidebar. Page paths match the old per-service sites, so `identity.docs.shellui.com/scim` becomes `docs.shellui.com/identity/scim`.

## Build locally

From the repository root:

```bash
pnpm install
pnpm docs:start   # dev server on http://localhost:3000 with live reload
pnpm docs:build   # production build in tools/docusaurus/build
pnpm docs:serve   # serve that build
```

`docs:start` and `docs:build` run `pnpm docs:fetch` first. Run it on its own to refresh the service docs without building:

```bash
pnpm docs:fetch
```

### Edit service docs with live reload

Clone the services next to this repository:

```text
workspace/
├── shellui/
├── identity-service/
├── storage-service/
├── hosting-service/
└── email-service/
```

With the default `DOCS_SOURCE=auto`, `docs:fetch` uses `../<service>/docs` in place when it exists, so `pnpm docs:start` reloads as you edit files in the service checkout. Services that are not cloned next to this repository are fetched from GitHub.

### Build from GitHub only

To build exactly what CI builds, ignoring sibling checkouts:

```bash
DOCS_SOURCE=remote pnpm docs:build
```

## Configuration

`docs:fetch` reads these environment variables. `<ID>` is `IDENTITY`, `STORAGE`, `HOSTING`, or `EMAIL`.

| Variable             | Default                | Effect                                                                                          |
| -------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| `DOCS_SOURCE`        | `auto`                 | `auto` tries a sibling checkout, then GitHub. `local` requires a sibling. `remote` uses GitHub. |
| `DOCS_SERVICES_DIR`  | parent of this repo    | Folder that holds the sibling checkouts                                                         |
| `DOCS_SERVICES`      | all                    | Comma separated ids to include, for example `identity,email`                                    |
| `DOCS_ALLOW_MISSING` | unset                  | Set to `1` to build without a service that cannot be fetched (for example offline)              |
| `DOCS_GITHUB_TOKEN`  | unset                  | Token for remote clones, only needed if a service repository becomes private                    |
| `<ID>_DOCS_REF`      | `main`                 | Branch, tag, or commit to fetch, for example `IDENTITY_DOCS_REF=v0.6.0`                         |
| `<ID>_DOCS_REPO`     | `shellui/<id>-service` | GitHub repository, for example a fork                                                           |
| `<ID>_DOCS_PATH`     | unset                  | Path to a local `docs/` folder. Forces local mode for that service                              |
| `<ID>_DOCS_SOURCE`   | `DOCS_SOURCE`          | `auto`, `local`, or `remote` for one service                                                    |

The list of services lives in `tools/docusaurus/services.js`. Adding a service there adds its docs instance, its folder, and its navbar entry.

## How it works

1. `tools/docusaurus/scripts/fetch-service-docs.js` resolves each service:
   - **Local:** the sibling `docs/` folder is used where it is, no copy.
   - **Remote:** a shallow, sparse clone that only checks out `docs/` and the sidebar file, copied to `tools/docusaurus/.services/<id>/`. That folder is gitignored.
2. It writes `tools/docusaurus/.services/manifest.json` with the path, mode, ref, and commit of each service.
3. `docusaurus.config.js` reads the manifest and adds one `@docusaurus/plugin-content-docs` instance per service, with its own `id`, `routeBasePath`, and sidebar. If the manifest is missing, the config runs the fetch itself.

### Sidebars

A service keeps control of its sidebar. The first file found is used:

1. `docs/sidebars.js`
2. `tools/docusaurus/sidebars.js`
3. otherwise `tools/docusaurus/sidebars.service-default.js` in this repository, which lists every doc in the folder

The navbar entry opens the first sidebar declared in that file.

### Compatibility with the main site

Service docs were written for their own Docusaurus site. The main site adjusts them at build time with `tools/docusaurus/plugins/remark-service-links.js`:

- Relative links that leave `docs/`, such as `[PUBLISH.md](../PUBLISH.md)`, become links to the file on GitHub at the fetched ref. Images that leave `docs/` use `raw.githubusercontent.com`.
- Links to the old hosts, such as `https://identity.docs.shellui.com/scim`, become internal links such as `/identity/scim`.
- Images and files inside `docs/`, such as `docs/examples/verify-shellui-webhook.mjs`, are bundled by Docusaurus like any other doc asset. Keep service images inside `docs/` and link them with a relative path. Absolute paths such as `/img/…` resolve against the main site's `static/` folder, not the service's.

Other safeguards:

- Each service is a separate docs instance, so doc ids such as `index` or `configuration` never collide across services.
- `onBrokenLinks: 'throw'` covers links inside service docs and links between services. A broken link in a service fails the docs build here.
- `onDuplicateRoutes: 'throw'` stops the build if a page in `docs/` claims a service path such as `/identity`.
- All repositories use Docusaurus 3 with the default MDX parser and no extra plugins, so service docs that build in their own repository build here.

## CI and deploys

`.github/workflows/deploy-docs.yml` runs `pnpm run docs:fetch` with `DOCS_SOURCE=remote`, then builds. It deploys to GitHub Pages from `main`. It runs on:

- pushes to `main`, `develop`, and `master` that touch the docs
- pull requests that touch the docs (build only)
- `workflow_dispatch`, to rebuild from the Actions tab
- `repository_dispatch` with the type `service-docs-updated`, sent by service repositories

Set the repository variables `IDENTITY_DOCS_REF`, `STORAGE_DOCS_REF`, `HOSTING_DOCS_REF`, or `EMAIL_DOCS_REF` to publish a tag instead of `main`.

## Service repository setup

Each service repository needs two changes, made in that repository.

### 1. Ask for a rebuild when docs change

Create a fine-grained token with **Contents: read and write** on `shellui/shellui` and save it as the secret `DOCS_DISPATCH_TOKEN` in the service repository. Then add `.github/workflows/docs-dispatch.yml`:

```yaml
name: Request docs rebuild

on:
  push:
    branches:
      - main
    paths:
      - 'docs/**'
      - 'tools/docusaurus/sidebars.js'
  workflow_dispatch:

jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - name: Ask shellui/shellui to rebuild docs.shellui.com
        env:
          GH_TOKEN: ${{ secrets.DOCS_DISPATCH_TOKEN }}
          SERVICE: ${{ github.event.repository.name }}
          SHA: ${{ github.sha }}
        run: |
          gh api repos/shellui/shellui/dispatches \
            -f event_type=service-docs-updated \
            -f "client_payload[service]=$SERVICE" \
            -f "client_payload[sha]=$SHA"
```

### 2. Stop deploying docs from the service

Once docs.shellui.com serves the service docs:

- Delete `.github/workflows/deploy-docs.yml`, `tools/generate-docs.sh`, and the `tools/docusaurus/` site. Move `tools/docusaurus/sidebars.js` to `docs/sidebars.js` first so the sidebar is kept.
- Keep the old host working by publishing a redirect to its `gh-pages` branch. GitHub Pages serves `404.html` for every unknown path, so one file covers deep links:

```html
<!doctype html>
<meta charset="utf-8" />
<title>Moved to docs.shellui.com</title>
<script>
  location.replace(
    'https://docs.shellui.com/identity' + location.pathname + location.search + location.hash,
  );
</script>
<meta
  http-equiv="refresh"
  content="0; url=https://docs.shellui.com/identity"
/>
```

Save it as both `index.html` and `404.html`, with the matching service path, next to the existing `CNAME` file.
