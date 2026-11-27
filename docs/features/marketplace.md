---
title: Shellui Marketplace
sidebar_label: Marketplace
description: 'Opt in to Shellui Marketplace, runtime navigation, and third-party app capabilities.'
---

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

## Desktop app

Shellui Marketplace is not available in the desktop (Tauri) app. A directory that installs web apps at runtime is not compatible with Mac App Store distribution, so the shell turns the marketplace off for the desktop target whatever `shellui.config.json` says. It also checks at runtime, so a desktop package built from a plain web build has it off too. It runs only in web builds.

## Navigation overlay

The overlay is version `1` and stores one layout per person and company:

- `installedApps`: apps added at runtime
- `order`: navigation paths
- `hiddenPaths`: paths hidden by the person
- `updatedAt`

Items with `locked: true` stay visible. People cannot hide or remove them.

## Capabilities

Static navigation items keep their current behavior, including `safeForAuthToken` and `childFrames` when you set them in config.

Every app installed at runtime is treated as third-party, whatever the catalog says. Installs start with **theme** and **language** only. **Interface**, **navigation**, **storage**, and **AI** are granted only after the person confirms in the host dialog. The dialog always appears, and it appears again when an installed app changes its origin, URL, or capabilities. The dialog names the app, its origin, and the capabilities that will be granted. Grants are stored on the install and can be changed later in Settings, under Installed apps, without uninstalling.

**Sign-in** and **embedded frames** are never granted to a third-party install. A payload that asks for `auth`, `safeForAuthToken`, or `childFrames` does not receive them.

Third-party iframes use `referrerPolicy="no-referrer"`, a sandbox of `allow-same-origin allow-scripts allow-forms` (no popups, no top navigation), and an empty Permissions-Policy `allow` attribute. Their document URL must be HTTPS. `http://localhost` is allowed for local development. Remote icons render in an image element. Inline SVG is not injected.

## Security model

- **One check for every layout.** Runtime installs, a layout read from `localStorage`, and a layout read from Identity all go through the same validator. It refuses `auth`, the shell's own origin, loopback and private hosts (except `http://localhost` in development), reserved paths, more than 100 apps, and a document over 64 KB. The JSON Schema lives in `packages/sdk/schemas/navigation-overlay.v1.json` and is shared with Identity, with a contract test on each side.
- **Core paths stay with the shell.** `admin` (or your configured admin path), `__settings`, `legal`, `files`, `login`, `marketplace`, `settings`, and anything starting with `__` cannot be claimed by an app, and `..` or encoded slashes are refused.
- **Third-party frames get appearance, language, region, and layout only.** They never receive the user, a token, the navigation list, admin data, or service URLs.
- **Short message allowlist.** A third-party frame can send `SHELLUI_INITIALIZED`, `SHELLUI_SETTINGS_REQUESTED`, `SHELLUI_CONTENT_SCROLL`, and the message types of the capabilities it was granted. Anything else is dropped. `SHELLUI_SETTINGS_UPDATED` is accepted only from the shell's own Settings page and cookie preferences page.
- **Honest labels.** A third-party app's navigation label ends with "(third-party)", and its toasts and dialogs are prefixed with the app name.
- **Frames only for installed origins.** The shell renders a third-party frame only when its origin matches an installed app. `http://localhost` is refused outside development. Grants, the token rule, and the settings a frame receives are all chosen by origin, so another path on an installed origin gets the same limits.
- **`frame-src` stays broad.** The shell CSP still allows `https:` in `frame-src` and is report-only by default, so it does not limit which apps can be installed. The installed-origin check above is the control. A host that enforces CSP and wants a tighter list has to narrow `frame-src` itself.
- **Layout conflicts.** If another device saved the layout first, the save is refused and the shell reads the newer layout from Identity, never from the device copy. Every removal made on this device that is not saved yet (a revoked capability, an uninstalled app, a reset) stays in force and is applied to the newer layout and to any other edit made meanwhile, until a save that includes it succeeds. Only what this device removed is taken out, so a capability or app added on the other device is kept. A change that only removes access is then saved once more. Any other change gives way to the newer layout, with a toast. If the newer layout cannot be read or the second save fails, the removals stay in force in the shell and a toast says plainly that the change was not saved. A reset that conflicts does not clear the device copy.
- **Identity unavailable.** If Identity cannot be reached or refuses a save for any reason other than a conflict, only the device copy is written. Identity still has the older layout, which wins on the next load, so the change counts as not saved: the removals stay in force and a toast says the change was NOT saved. The next save that reaches Identity carries them. A reset that Identity refuses is reported the same way.
- **Unsaved removals.** They are kept in this tab's `sessionStorage` under the signed-in user and company, so a page reload does not hand the access back. Another account or company signing in on the same tab never gets them. Granting a capability again, or installing the app again, undoes the matching removal.
- **Layout sync.** The shell sends the access token only to an HTTPS layout API on a known origin (the Identity base URL of the shell). The copy kept on the device is not uploaded when someone signs in.

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

The CLI reads `GET {apiUrl}/api/apps/<app-id>`. The default `apiUrl` is `https://api.marketplace.shellui.com`. It appends a `NavigationItem` to `shellui.config.json` (or `shellui.navigation.config.json` when config is split). The URL must be HTTPS. The CLI decides for itself whether an app is official: its origin has to be on a short built-in list (`https://admin.shellui.com`, `https://dashboard.shellui.com`, `https://files.shellui.com`). Other `shellui.com` hosts are not official. The catalog's own flags are ignored. A non-official app that sets `safeForAuthToken` is refused unless you pass `--allow-auth`. Paths that the shell routes itself (`admin`, `__settings`, `legal`, `files`, `login`, `marketplace`, `settings`) are refused. An existing path is left unchanged and the command exits with an error. The command prints the name, path, URL, whether the URL is official, and whether the token will be shared.

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
