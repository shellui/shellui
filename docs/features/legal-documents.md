---
title: Publish legal documents
sidebar_label: Legal Documents
description: Put privacy, terms, legal notice, and DPA markdown in legalDocuments so the shell serves public /legal routes.
---

Publish Privacy Policy, Terms of Service, Legal Notice, and Data Processing Agreement from markdown in config. The shell renders them - no separate legal site or navigation item. Pages are **public** (no sign-in) on dedicated routes outside the main layout. Signed-in users can also open the same content from Settings.

When at least one document has non-empty markdown, the shell registers `/legal` routes, shows footer links on the top-level login page, and adds **Settings → System → Legal documents**. If every key is missing or empty, routes still exist with "not configured" copy, login footer links are hidden, and the Settings entry is omitted.

## Configuration

Each property is a **markdown string** loaded when config is read (not a URL). JSON:

```json
{
  "$schema": "./node_modules/@shellui/core/schemas/shellui.config.schema.json",
  "title": "My App",
  "legalDocuments": {
    "privacyPolicy": "# Privacy Policy\n\n…",
    "termsOfService": "# Terms of Service\n\n…"
  }
}
```

TypeScript config (only when no JSON/split file is present) can `readFileSync` files from disk:

```typescript
import type { ShellUIConfig } from "@shellui/core";
import { readFileSync } from "node:fs";

const config: ShellUIConfig = {
  title: "My App",
  legalDocuments: {
    privacyPolicy: readFileSync(new URL("./legal/privacy-policy.md", import.meta.url), "utf8"),
    termsOfService: readFileSync(new URL("./legal/terms-of-service.md", import.meta.url), "utf8"),
    legalNotice: readFileSync(new URL("./legal/legal-notice.md", import.meta.url), "utf8"),
    dataProcessingAgreement: readFileSync(
      new URL("./legal/data-processing-agreement.md", import.meta.url),
      "utf8",
    ),
  },
};

export default config;
```

| Config key | Default title | Public path |
| --- | --- | --- |
| `privacyPolicy` | Privacy Policy | `/legal/privacy-policy` |
| `termsOfService` | Terms of Service | `/legal/terms-of-service` |
| `legalNotice` | Legal Notice | `/legal/legal-notice` |
| `dataProcessingAgreement` | Data Processing Agreement | `/legal/data-processing-agreement` |

Type: `LegalDocumentsConfig`. Omit keys or pass `""`. `getLegalDocuments()` keeps entries whose trimmed value is non-empty.

## How people open them

| Path | View |
| --- | --- |
| `/legal` | Index of configured documents |
| `/legal/privacy-policy` | Privacy Policy |
| `/legal/terms-of-service` | Terms of Service |
| `/legal/legal-notice` | Legal Notice |
| `/legal/data-processing-agreement` | Data Processing Agreement |

Document pages include **Back to login**. These routes are not in `navigation` and are not iframe targets.

On `/login`, configured documents appear as footer links (root window only - not when login is in an iframe). Settings: `/__settings/legal-documents` when at least one document exists. Labels follow `settings.routes.legalDocuments`.

Content uses `react-markdown` and Shellui typography. Markdown links open in a new tab with `rel="noreferrer"`. Breadcrumbs (**Legal documents** → title) hide when the view is inside an iframe.

After editing markdown or config, rely on `shellui start` config watch or restart the CLI.
