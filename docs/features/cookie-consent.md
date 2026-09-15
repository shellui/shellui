---
title: Collect cookie consent
sidebar_label: Cookie Consent
description: 'Declare cookies in config, show the consent UI, and gate features with useCookieConsent(host).'
---

Declare cookies in `cookieConsent.cookies`. The shell shows a consent modal, stores accepted hosts in settings, and re-prompts when you add a host that was not in the last consent set. Gate third-party features on that list before you initialize them.

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  cookieConsent: {
    cookies: [
      {
        name: 'Sentry Error Reporting',
        host: 'sentry.io',
        durationSeconds: 31536000,
        type: 'third_party',
        category: 'functional_performance',
        description: {
          en: 'Sends uncaught errors to Sentry so production failures can be fixed.',
          fr: 'Envoie les erreurs non gérées à Sentry pour corriger les pannes en production.',
        },
      },
    ],
  },
};
```

## Categories and fields

Categories: `strict_necessary`, `functional_performance`, `targeting`, `social_media_embedded`.

Each cookie:

- **`name`** (required): display name
- **`host`** (required): unique key for consent and gating (`sentry.io`, `.example.com`)
- **`durationSeconds`** (required): duration in seconds (`31536000` = 1 year)
- **`type`** (required): label such as `first_party`, `third_party`, `http_only`
- **`category`** (required)
- **`description`** (optional): string or localized object

First visit shows Accept all, Reject all, or Set preferences. Choices live in `settings.cookieConsent.acceptedHosts`. `consentedCookieHosts` records which hosts existed when consent was last recorded. New hosts trigger the modal again with previous approvals pre-filled.

Users reopen the UI from **Settings → Data Privacy → Cookie Preferences**, or the built-in route `/__cookie-preferences` (`urls.cookiePreferences` in `@shellui/core`). The consent modal opens that route in a drawer.

## Gate a feature

In host React (under the shell providers):

```typescript
import { useCookieConsent } from '@shellui/core';
import { useEffect } from 'react';

function ErrorReporting() {
  const { isAccepted, needsConsent } = useCookieConsent('sentry.io');

  useEffect(() => {
    if (isAccepted) {
      initSentry();
    }
  }, [isAccepted, needsConsent]);

  return null;
}
```

Outside React:

```typescript
import { getCookieConsentAccepted } from '@shellui/core';

if (getCookieConsentAccepted('sentry.io')) {
  initSentry();
}
```

Production Sentry in the shell also follows [Sentry env vars](/sentry). Consent is a separate switch for features you initialize yourself.

This registry and UI are meant to support GDPR, CCPA, and ePrivacy-style disclosure. They are not legal advice. Pair them with [legal documents](/features/legal-documents) you actually publish.
