# Chrome actions demo

Minimal local harness for [issue #41](https://github.com/shellui/shellui/issues/41) — floating action buttons via the Shellui SDK.

> The primary clickable showcase will live in [shellui/playground](https://github.com/shellui/playground). Use this example for monorepo / CI verification of the protocol and chrome.

## Run

From the monorepo root (after `pnpm install`):

```bash
pnpm --dir examples/chrome-actions start
```

Opens the shell on **http://localhost:3100** with a Vite companion on **http://localhost:5174**.

Narrow the viewport (or DevTools device mode) to see trailing actions collapse into `···`. Switch **Settings → Develop → Layout** to try Windows title-bar placement.

## What to try

| Action                                 | Expected                                         |
| -------------------------------------- | ------------------------------------------------ |
| Load Home                              | Top: back + title + trailing; bottom primary FAB |
| Click trailing / FAB                   | Log line updates (callback round-trip)           |
| **Update actions** / **Clear actions** | Chrome updates or disappears                     |
| Shell nav → **Second view**            | Home actions clear; second view sets its own     |
