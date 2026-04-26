# Legal Documents

Use `legalDocuments` in `shellui.config.ts` to publish legal content such as Privacy Policy, Terms of Service, Legal Notice, and Data Processing Agreement.

ShellUI renders these documents in:

- Public legal routes (for unauthenticated users)
- Login page footer links (outside iframe mode)
- Settings > System > Legal documents

## Configuration

Add a `legalDocuments` section to your config. Each value is a markdown string.

```typescript
import type { ShellUIConfig } from '@shellui/core';
import { readFileSync } from 'node:fs';

const config: ShellUIConfig = {
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

## Supported Keys

- `privacyPolicy`
- `termsOfService`
- `legalNotice`
- `dataProcessingAgreement`

If a key is missing or empty, that document is automatically hidden from legal navigation and routes.

## Recommended File Structure

Store markdown files in your project root:

```text
your-app/
├── shellui.config.ts
└── legal/
    ├── privacy-policy.md
    ├── terms-of-service.md
    ├── legal-notice.md
    └── data-processing-agreement.md
```

## Routes

When configured, ShellUI exposes:

- `/legal` (index page with all available documents)
- `/legal/privacy-policy`
- `/legal/terms-of-service`
- `/legal/legal-notice`
- `/legal/data-processing-agreement`

## Markdown Rendering

Legal document content is rendered from markdown with ShellUI typography styles (headings, lists, links, blockquotes, inline code).  
Use markdown headings (`#`, `##`, `###`) to structure long legal text.

