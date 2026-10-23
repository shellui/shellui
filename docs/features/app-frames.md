---
title: Host an app inside an app
sidebar_label: App frames
description: 'Use createAppFrame or ShelluiFrame so an embedded app can host another Shellui app with its own session.'
---

# Apps inside apps

An app that already runs inside the shell can host another Shellui app in its own iframe. The SDK turns the host app into a small relay, so the child app gets the same theme, language, session and messages as any app the shell embeds.

## Host side

```tsx
import { ShelluiFrame } from '@shellui/sdk/react';

<ShelluiFrame
  title="Admin"
  src="https://admin.shellui.com/users"
  backend={{ url: 'https://id.eu.shellui.com', companyId: 'abc' }}
  onNavigate={(location) => navigate(`/admin${location.fullPath}`)}
  fallback={<Spinner />}
  renderError={(retry) => <Button onClick={retry}>Retry</Button>}
/>;
```

Without React, call `createAppFrame(iframe, { url, backend, onNavigate, onReady })` from `@shellui/sdk` and `destroy()` the handle when the frame goes away.

- The frame stays hidden behind the `fallback` slot until the child app sends `SHELLUI_INITIALIZED`. If it does not arrive within 20 seconds, the `renderError` slot shows with a retry.
- A new `src` or `backend` reloads the frame and shows the fallback again.
- `onNavigate` receives the child URL on every route change. Mirror it in the host route, and pass it back in `src` to deep link.

## Shell config

Hosting is off by default. Allow it on the host app's navigation item, with exact origins only:

```json
{
  "label": "Dashboard",
  "url": "https://dashboard.shellui.com/",
  "childFrames": {
    "origins": ["https://admin.shellui.com"],
    "backendOrigins": ["https://id.eu.shellui.com"]
  }
}
```

## How it works

- The host SDK trusts only the child's exact origin and window. It relays child messages (settings requests, toasts, dialogs and so on) to the shell, and routes the shell replies back down.
- The host registers the child with `SHELLUI_CHILD_FRAME_REGISTER`. The shell accepts it only from a direct app frame whose item allows that child origin and backend origin.
- The shell signs in to the child's identity server with the same isolated session it uses for per-app backends (token exchange for a regional server with `provider: "upstream"`, silent sign-in otherwise), and refreshes it. The child gets that session only. The shell token is never sent to a child.
- A child with no allowed backend gets settings with no token, no user and no service URLs.
- Theme, language and token changes are pushed to every registered child.

## Route sync for the host app

The SDK already reports every history change of an embedded app to the shell (`SHELLUI_URL_CHANGED`), and the shell loads the frame at the right URL on back, forward and deep links. Apps that use a router library (React Router, TanStack Router) need nothing more.

Apps without a router can use the helpers instead of writing to `history` by hand:

```tsx
import { useShelluiNavigation } from '@shellui/sdk/react';

const { location, navigate } = useShelluiNavigation(import.meta.env.BASE_URL);
// location.path is relative to the base, such as `/companies/42/admin/users`.
navigate('/companies/42/settings');
```

Outside React, use `navigateApp(path, { basePath })`, `readAppLocation(basePath)` and `subscribeAppLocation(listener)` from `@shellui/sdk`.

Composing with a nested frame: put the child path inside the host path (for example `/companies/42/admin/<child path>`) and update it from `ShelluiFrame`'s `onNavigate`. The shell URL then carries both, and a reload opens the host and the child at the same place.
