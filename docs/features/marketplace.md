---
title: Shellui Marketplace
sidebar_label: Marketplace
description: 'Opt in to Shellui Marketplace, runtime navigation, and third-party app capabilities.'
---

Shellui Marketplace is free. `shellui.config.json` has no price or payment fields.

## Opt in

The shortest config turns the marketplace on with public defaults:

```json
{
  "marketplace": true
}
```

That resolves to:

| Field                     | Default                                  |
| ------------------------- | ---------------------------------------- |
| `url`                     | `https://marketplace.shellui.com`        |
| `apiUrl`                  | `https://api.marketplace.shellui.com`    |
| `allowThirdParty`         | `true`                                   |
| `navigationCustomization` | `{ "enabled": true, "storage": "auto" }` |

An object overrides only the fields you set. Omitted fields keep the defaults above.

```json
{
  "marketplace": {
    "allowThirdParty": false,
    "navigationCustomization": { "storage": "localStorage" }
  }
}
```

`storage: "auto"` syncs the navigation overlay with Shellui Identity when the person is signed in and `backend` is a Shellui identity server. Otherwise the overlay stays in `localStorage`. `storage: "api"` always uses Identity. The Identity routes are `GET`, `PUT`, and `DELETE` `{backend.url}/api/v1/navigation-overlay` (the same style as `/api/v1/preferences`). Set `navigationCustomization.apiUrl` when that endpoint lives somewhere else.

When marketplace is on, the shell adds a locked **Shellui Marketplace** route.

## Navigation overlay

The overlay is version `1` and stores:

- `installedApps`: apps added at runtime
- `order`: navigation paths
- `hiddenPaths`: paths hidden by the person
- `updatedAt`

Items with `locked: true` stay visible. People cannot hide or remove them.

## Capabilities

Static navigation items keep their current behavior, including `safeForAuthToken` and `childFrames` when you set them in config.

Third-party installs start with **theme** and **language** only. **Interface**, **navigation**, **storage**, and **AI** require a host confirmation dialog at install time. The dialog names the app, its origin, and the capabilities that will be granted. Grants are stored on the install and can be changed later in Settings, under Installed apps, without uninstalling.

**Sign-in** and **embedded frames** are never granted to a third-party install. A payload that asks for `auth`, `safeForAuthToken`, or `childFrames` does not receive them.

Third-party iframes use `referrerPolicy="no-referrer"`, a sandbox without `allow-top-navigation`, and an empty Permissions-Policy `allow` attribute. Their document URL must be HTTPS. `http://localhost` is allowed for local development. Remote icons render in an image element. Inline SVG is not injected.

## Customize navigation

When `navigationCustomization.enabled` is true, Settings includes **Navigation**. From there a person can:

- Move items up or down (buttons, keyboard focus, locked items included)
- Hide or show unlocked items. `locked: true` stays visible and shows a locked state
- Uninstall an app that was installed from Shellui Marketplace
- Turn `ui`, `navigate`, `storage`, and `ai` off for a third-party app without uninstalling it. The change applies on the next message from that frame
- Reset navigation to the build-time `shellui.config.json` list

## shellui add

```bash
shellui add notes
shellui add notes --api-url https://api.marketplace.shellui.com
shellui add notes --allow-auth
```

The CLI reads `GET {apiUrl}/api/apps/<app-id>`. The default `apiUrl` is `https://api.marketplace.shellui.com`. It appends a `NavigationItem` to `shellui.config.json` (or `shellui.navigation.config.json` when config is split). The URL must be HTTPS. A non-official app that sets `safeForAuthToken` is refused unless you pass `--allow-auth`. An existing path is left unchanged and the command exits with an error. The command prints the name, path, URL, whether the catalog marked the app official, and whether the token will be shared.

## SDK

From the marketplace frame only:

```ts
await shellui.marketplace.listInstalledApps();
await shellui.marketplace.installApp({
  id: 'notes',
  name: 'Notes',
  url: 'https://notes.example.com/',
  thirdParty: true,
  capabilities: ['ui', 'storage'],
});
await shellui.marketplace.uninstallApp('notes');
```

The host rejects `shellui.marketplace.*` messages from every other origin.
