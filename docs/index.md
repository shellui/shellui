---
title: Shellui docs
sidebar_label: Introduction
description: 'Developer map for Shellui - a microfrontend shell with shared navigation, authentication, administration, and storage.'
---

Shellui is an open-source web app development platform - a microfrontend shell that wraps your application with shared navigation, authentication, storage, and administration. This site documents `@shellui/cli`, `@shellui/core`, and `@shellui/sdk` for developers who host an iframe app inside that shell.

## Start here

1. [Install the CLI](/installation) - add `@shellui/cli` globally or in a project
2. [Create a project](/quickstart) - run `shellui init`, start the dev server, and build
3. [Framework starters](/framework-starters) - per-framework companions, ports, theme, and i18n
4. [Connect a backend](/backend) - Shellui identity-service, Supabase Auth, or no backend
5. [Configure authentication](/features/authentication) - `/login`, sessions, and `requiresAuth`
6. [Configure navigation](/features/navigation) - sidebar items, groups, and iframe URLs
7. [Use the SDK](/sdk) - toasts, overlays, storage, and settings from the iframe

Canonical docs live at [docs.shellui.com](https://docs.shellui.com). Try a running shell on [playground.shellui.com](https://playground.shellui.com). Source is on [GitHub](https://github.com/shellui/shellui).

## Features

### Navigation and layout

- [Navigation](/features/navigation) - icons, groups, locales, opening modes, and route guards
- [Layouts](/features/layouts) - sidebar, inset, fullscreen, app bar, floating, and windows
- [Modals and drawers](/features/modals-drawers) - overlays for nav targets and SDK calls

### Appearance

- [Themes](/features/themes) - light and dark tokens, curated palettes, and `themesDir`
- [Internationalization](/features/internationalization) - `en` / `fr` labels and Settings language

### Shell UI

- [Toasts](/features/toasts) - host toasts from `@shellui/sdk`
- [Dialogs](/features/dialogs) - confirm and alert dialogs in host chrome
- [Floating chrome actions](/features/chrome-actions) - back / title / trailing / primary FAB via the SDK

### Platform

- [Administration](/features/administration) - staff admin iframe and custom sidebar links
- [On-device AI](/features/ai) - Settings → AI, Ollama / browser models, and `shellui.ai`
- [Storage](/features/storage) - storage-service quota and `shellui.storage`
- [Storage picker](/features/storage-picker) - `selectFolders` / `selectFiles`
- [Application settings](/features/application-settings) - per-app panels in Settings
- [Cookie consent](/features/cookie-consent) - cookie registry and feature gating
- [Legal documents](/features/legal-documents) - privacy and terms from markdown
- [Service worker](/features/service-worker) - opt-in caching and update prompts

## Packages

- [CLI](/cli) - commands, config files, env substitution, and `shellui deploy`
- [Core](/core) - React runtime, config types, and `useAuth`
- [SDK](/sdk) - iframe APIs, including the CDN tiny script
- [Desktop app](/tauri) - `shellui dev --app` and Tauri 2 bundles

## Contribute and operate

- [Development](/development) - build this monorepo
- [Publishing](/publishing) - npm tags and version sync
- [Sentry](/sentry) - production error reporting
- [ADR 0001](/adr/ai-skill) - agent skill hosting and token budget
- [Playground source](https://github.com/shellui/playground) - one package where `pnpm start` runs the shell plus a Vite iframe app

Official agent skills live in [shellui/skills](https://github.com/shellui/skills). Install with `npx skills add shellui/skills --skill shellui`.
