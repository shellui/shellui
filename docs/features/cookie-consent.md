# Cookie Consent

ShellUI provides a privacy-friendly cookie consent management system that helps you comply with privacy regulations while giving users control over their data.

## Configuration

Configure cookie consent in your ShellUI configuration:

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  cookieConsent: {
    cookies: [
      {
        name: 'Sentry Error Reporting',
        host: 'sentry.io',
        durationSeconds: 31536000, // 1 year
        type: 'third_party',
        category: 'functional_performance',
        description: {
          en: 'Helps us fix errors and improve stability.',
          fr: 'Nous aide à corriger les erreurs et à améliorer la stabilité.',
        },
      },
    ],
  },
};
```

## Cookie Categories

Cookies are organized into privacy-friendly categories:

### Strict Necessary

Required for the app to function. Typically no consent needed, but should be declared:

```typescript
{
  name: 'Session Cookie',
  host: '.example.com',
  durationSeconds: 3600, // 1 hour
  type: 'first_party',
  category: 'strict_necessary',
  description: {
    en: 'Required for user authentication.',
  },
}
```

### Functional Performance

Analytics, performance monitoring, and preferences:

```typescript
{
  name: 'Sentry Error Reporting',
  host: 'sentry.io',
  durationSeconds: 31536000, // 1 year
  type: 'third_party',
  category: 'functional_performance',
  description: {
    en: 'Helps us fix errors and improve stability.',
  },
}
```

### Targeting

Advertising and personalization:

```typescript
{
  name: 'Google Analytics',
  host: 'google-analytics.com',
  durationSeconds: 63072000, // 2 years
  type: 'third_party',
  category: 'targeting',
  description: {
    en: 'Used for advertising and personalization.',
  },
}
```

### Social Media Embedded

Social widgets and embedded content:

```typescript
{
  name: 'Twitter Widget',
  host: 'twitter.com',
  durationSeconds: 31536000, // 1 year
  type: 'third_party',
  category: 'social_media_embedded',
  description: {
    en: 'Enables embedded Twitter content.',
  },
}
```

## Cookie Definition

Each cookie definition includes:

- **`name`** (string, required): Display name for the cookie
- **`host`** (string, required): Host or domain the cookie belongs to (e.g., "sentry.io", ".example.com"). This is the unique key used for consent and feature gating.
- **`durationSeconds`** (number, required): Cookie duration in seconds (e.g., 31536000 for 1 year)
- **`type`** (string, required): Cookie type label (e.g., "first_party", "third_party", "http_only")
- **`category`** (CookieConsentCategory, required): Privacy category
- **`description`** (LocalizedString, optional): Description shown in consent/preferences UI

## Localized Descriptions

Cookie descriptions can be localized:

```typescript
{
  name: 'Analytics Cookie',
  host: 'analytics.example.com',
  durationSeconds: 31536000,
  type: 'third_party',
  category: 'functional_performance',
  description: {
    en: 'Helps us understand how users interact with our app.',
    fr: 'Nous aide à comprendre comment les utilisateurs interagissent avec notre application.',
  },
}
```

## Consent Flow

1. **First Visit**: User sees cookie consent modal on first visit
2. **User Choice**: User can Accept All, Reject All, or Set Preferences
3. **Storage**: Consent choices are stored in user settings
4. **Feature Gating**: Use consent status to enable/disable features
5. **Renewal**: If new cookies are added, user is prompted again

## Checking Consent Status

Check if a cookie host has been accepted before enabling features:

### In React Components

```typescript
import { useCookieConsent } from '@shellui/core';

function MyComponent() {
  const { isAccepted, needsConsent } = useCookieConsent('sentry.io');

  useEffect(() => {
    if (isAccepted) {
      // Initialize Sentry
      initSentry();
    } else if (needsConsent) {
      // Show consent prompt or disable feature
      console.log('Sentry requires consent');
    }
  }, [isAccepted, needsConsent]);

  return <div>...</div>;
}
```

### Programmatically

```typescript
import { getCookieConsentAccepted } from '@shellui/core';

// Check if a host is accepted
const isAccepted = getCookieConsentAccepted('sentry.io');

if (isAccepted) {
  // Enable feature
  initSentry();
} else {
  // Feature is disabled
  console.log('Sentry requires consent');
}
```

## Complete Example

Here's a complete cookie consent configuration:

```typescript
import type { ShellUIConfig } from '@shellui/core';

const config: ShellUIConfig = {
  language: ['en', 'fr'],
  cookieConsent: {
    cookies: [
      {
        name: 'Session Cookie',
        host: '.example.com',
        durationSeconds: 3600,
        type: 'first_party',
        category: 'strict_necessary',
        description: {
          en: 'Required for user authentication and session management.',
          fr: 'Nécessaire pour l\'authentification et la gestion de session.',
        },
      },
      {
        name: 'Sentry Error Reporting',
        host: 'sentry.io',
        durationSeconds: 31536000, // 1 year
        type: 'third_party',
        category: 'functional_performance',
        description: {
          en: 'Helps us fix errors and improve stability.',
          fr: 'Nous aide à corriger les erreurs et à améliorer la stabilité.',
        },
      },
      {
        name: 'Google Analytics',
        host: 'google-analytics.com',
        durationSeconds: 63072000, // 2 years
        type: 'third_party',
        category: 'targeting',
        description: {
          en: 'Used for analytics and advertising.',
          fr: 'Utilisé pour l\'analyse et la publicité.',
        },
      },
    ],
  },
};
```

## Cookie Preferences

Users can manage their cookie preferences:

1. **Settings UI**: Settings > Data Privacy > Cookie Preferences
2. **Direct URL**: `/cookie-preferences` (if configured)
3. **From Consent Modal**: Click "Set Preferences" button

The preferences view allows users to:
- See all cookies by category
- Toggle individual cookies on/off
- Accept or reject all cookies
- View cookie descriptions and durations

## Consent Renewal

If you add new cookies to your configuration after a user has already consented, ShellUI will:

1. Detect new cookies (hosts not in `consentedCookieHosts`)
2. Show the consent modal again
3. Pre-fill with existing approvals
4. Allow users to approve new cookies while keeping existing choices

This ensures users are always informed about new cookies while respecting their previous choices.

## Best Practices

1. **Be transparent**: Provide clear descriptions of what each cookie does
2. **Use appropriate categories**: Categorize cookies correctly for user understanding
3. **Gate features**: Always check consent before enabling features that use cookies
4. **Respect choices**: Honor user preferences - don't enable features without consent
5. **Localize descriptions**: Provide translations for all enabled languages
6. **Minimize cookies**: Only request consent for cookies you actually need

## Feature Gating Example

Here's how to gate a feature based on consent:

```typescript
import { useCookieConsent } from '@shellui/core';
import { initSentry } from './sentry';

function App() {
  const { isAccepted } = useCookieConsent('sentry.io');

  useEffect(() => {
    if (isAccepted) {
      // Only initialize Sentry if consent is given
      initSentry({
        dsn: process.env.SENTRY_DSN,
      });
    }
  }, [isAccepted]);

  return <div>...</div>;
}
```

## Privacy Compliance

ShellUI's cookie consent system helps you comply with:
- **GDPR** (General Data Protection Regulation)
- **CCPA** (California Consumer Privacy Act)
- **ePrivacy Directive**

Key features:
- ✅ User consent before setting cookies
- ✅ Granular control per cookie
- ✅ Clear descriptions and categories
- ✅ Easy preference management
- ✅ Consent renewal for new cookies

## Related Guides

- [Internationalization](/features/internationalization) - Localized cookie descriptions
- [SDK Integration](/sdk) - Programmatic consent checking
- [Sentry Integration](/sentry) - Error reporting with consent
