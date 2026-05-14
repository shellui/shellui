# Legal documents

Publish Privacy Policy, Terms of Service, Legal Notice, and Data Processing Agreement from markdown in `shellui.config.ts`. ShellUI renders the content in the shell—no separate legal site or navigation item is required.

Legal pages are **public**: they work without sign-in and sit on dedicated routes outside the main app layout (no sidebar). Signed-in users can also open the same content from **Settings**.

## What ShellUI does in the UI

When at least one document has non-empty markdown, ShellUI:

- Registers **public routes** under `/legal` for the index and each configured document.
- Shows **footer links** on the login page (root window only, not when login runs inside an iframe).
- Adds **Settings → System → Legal documents** with a tab per document and inline markdown preview.

If every key is missing or empty, legal routes stay registered but show “not configured” copy, login footer links are hidden, and the Settings entry is omitted.

## Configuration

Add `legalDocuments` to `shellui.config.ts` or `shellui.config.json`. Each property is a **markdown string** loaded at config read time (not a URL).

### TypeScript with files on disk

Keep long text in `legal/*.md` and load it when the config is evaluated:

```typescript
import type { ShellUIConfig } from '@shellui/core';
import { readFileSync } from 'node:fs';

const config: ShellUIConfig = {
  title: 'My App',
  legalDocuments: {
    privacyPolicy: readFileSync(new URL('./legal/privacy-policy.md', import.meta.url), 'utf8'),
    termsOfService: readFileSync(new URL('./legal/terms-of-service.md', import.meta.url), 'utf8'),
    legalNotice: readFileSync(new URL('./legal/legal-notice.md', import.meta.url), 'utf8'),
    dataProcessingAgreement: readFileSync(
      new URL('./legal/data-processing-agreement.md', import.meta.url),
      'utf8',
    ),
  },
};

export default config;
```

### JSON config

Inline markdown or load strings in a small build step; the config shape is the same:

```json
{
  "title": "My App",
  "legalDocuments": {
    "privacyPolicy": "# Privacy Policy\n\n…",
    "termsOfService": "# Terms of Service\n\n…"
  }
}
```

### Supported keys

| Config key                | Default title in UI       | Public path                        |
| ------------------------- | ------------------------- | ---------------------------------- |
| `privacyPolicy`           | Privacy Policy            | `/legal/privacy-policy`            |
| `termsOfService`          | Terms of Service          | `/legal/terms-of-service`          |
| `legalNotice`             | Legal Notice              | `/legal/legal-notice`              |
| `dataProcessingAgreement` | Data Processing Agreement | `/legal/data-processing-agreement` |

Types are defined as `LegalDocumentsConfig` on `ShellUIConfig` in `@shellui/core`.

### Partial configuration

Omit keys you do not need, or pass an empty string. `getLegalDocuments()` only includes entries whose value is a non-empty string after `trim()`. Those documents are excluded from login links, the `/legal` index list, and Settings tabs.

## How users open legal content

### Direct URLs

Share or link to these paths on the shell origin (for example `http://localhost:4000` in development):

| Path                               | View                                    |
| ---------------------------------- | --------------------------------------- |
| `/legal`                           | Index listing every configured document |
| `/legal/privacy-policy`            | Privacy Policy                          |
| `/legal/terms-of-service`          | Terms of Service                        |
| `/legal/legal-notice`              | Legal Notice                            |
| `/legal/data-processing-agreement` | Data Processing Agreement               |

Document pages include a **Back to login** link. The index page lists documents and also links back to `/login`.

These routes are **not** part of your `navigation` array. They do not appear in the sidebar and are not iframe targets for microfrontends.

### Login page

On `/login`, configured documents appear as small text links in a footer below the sign-in form. Links use in-app routing (`react-router`) to the `/legal/...` paths.

The footer is rendered only in the **top-level** login view (`window.parent === window`). If login is embedded in an iframe, legal links are not shown on that surface.

### Settings

Open the built-in settings route (default `/__settings`), then **System → Legal documents** (`/__settings/legal-documents`).

The panel shows one button per document; the selected document’s markdown is rendered below. This route appears only when `getLegalDocuments(config)` returns at least one document.

Settings labels follow the active locale (`settings.routes.legalDocuments` in English and French).

## Markdown rendering

Content is rendered with `react-markdown` and ShellUI typography (headings, paragraphs, lists, blockquotes, inline code). Links in markdown open in a new tab with `rel="noreferrer"`.

On standalone legal and settings views, a breadcrumb links **Legal documents** → document title. Breadcrumbs are hidden when the content is shown inside an iframe.

Use markdown headings (`#`, `##`, `###`) to structure long policy text. The renderer supplies document-level styling; you do not need to ship CSS for legal pages.

## Recommended project layout

```text
your-app/
├── shellui.config.ts
└── legal/
    ├── privacy-policy.md
    ├── terms-of-service.md
    ├── legal-notice.md
    └── data-processing-agreement.md
```

After editing markdown, restart or rely on config watch (`shellui start`) so the dev server reloads `shellui.config.ts`.

## Related guides

- [Authentication](/features/authentication) — login page and `/login` route
- [Application settings](/features/application-settings) — per-app panels under Settings
- [Quick Start](/quickstart) — `legalDocuments` in the config overview
- [CLI](/cli) — configuration file format
