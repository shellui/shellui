# Shellui Documentation Website

This directory contains the Docusaurus site published at https://docs.shellui.com.
It renders the Shellui docs from `../../docs/` and the docs of each Shellui service
(identity, storage, hosting, email), fetched at build time.

Full guide: [docs/docs-site.md](../../docs/docs-site.md).

## Structure

- `docusaurus.config.js` - Main Docusaurus configuration, including one docs instance per service
- `sidebars.js` - Sidebar for the Shellui docs
- `services.js` - List of services, their URLs, and the environment variables the fetch reads
- `scripts/fetch-service-docs.js` - Collects service docs and writes `.services/manifest.json`
- `plugins/remark-service-links.js` - Fixes service doc links that only worked on the old per-service sites
- `sidebars.service-default.js` - Sidebar for a service that does not ship one
- `.services/` - Fetched service docs (gitignored)
- `src/` - React components and custom CSS
- `static/` - Static assets (images, fonts, etc.)

## Commands

Run from the repository root:

```bash
pnpm install
pnpm docs:fetch   # fetch service docs only
pnpm docs:start   # fetch, then dev server on http://localhost:3000
pnpm docs:build   # fetch, then production build in tools/docusaurus/build
pnpm docs:serve   # serve the build
```

`DOCS_SOURCE=auto` (default) uses sibling checkouts such as `../identity-service/docs`
in place, so edits there live reload. Services without a sibling checkout are cloned
from GitHub (shallow, sparse, docs only). Use `DOCS_SOURCE=remote` to match CI, and
`IDENTITY_DOCS_REF=<branch|tag|sha>` (or `STORAGE_`, `HOSTING_`, `EMAIL_`) to pick a ref.

## Deployment

`.github/workflows/deploy-docs.yml` fetches the service docs from GitHub, builds, and
deploys to GitHub Pages from `main`. Service repositories can request a rebuild with a
`repository_dispatch` event of type `service-docs-updated`.
