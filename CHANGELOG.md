# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

<!---
## [Unreleased] - yyyy-mm-dd

### ✨ Feature – for new features
### 🛠 Improvements – for general improvements
### 🚨 Changed – for changes in existing functionality
### ⚠️ Deprecated – for soon-to-be removed features
### 📚 Documentation – for documentation update
### 🗑 Removed – for removed features
### 🐛 Bug Fixes – for any bug fixes
### 🔒 Security – in case of vulnerabilities
### 🏗 Chore – for tidying code

See for sample https://raw.githubusercontent.com/favoloso/conventional-changelog-emoji/master/CHANGELOG.md
-->

## [0.2.0] - 2026-02-20

### ✨ Feature

- **Application settings:** navigation items can define a `settings` URL to display their own settings panel in Settings > Applications.
- **Layout:** new **app-bar** layout with compact top bar, select menu for start links, and icon-only end links with tooltips
- **CLI:** `shellui init [root]` command to create a `shellui.config.ts` boilerplate (use `--force` to overwrite)

### 🛠 Improvements

- **Themes:** default theme now uses local fonts from `static/fonts/` (Open Sans, Source Serif 4) instead of Google Fonts; theme docs updated for local font setup
- **Navigation:** support `start_url` to redirect "/" and navigation items with path `""` or `"/"` as the start page
- **Navigation:** handling navigation for applications using hash navigation
- Improved **Sentry** error reporting integration
- **CLI:** `shellui start --host` to expose the dev server to the network

### 🐛 Bug Fixes

- **iPad/Radix:** fixed modal/dialog buttons when using Apple Pencil or touch

### 🔒 Security

- **Dependencies:** updated to address security issues

## [0.1.0] - 2026-02-09

### ✨ Feature

- Multiple **layout modes**: **sidebar navigation**, **fullscreen** content view, and **windows desktop mode** with taskbar
- Flexible **navigation menu** with icons, grouped items, and customizable organization
- Open links in different ways: main content area, **modal popups**, **side drawers**, or external browser
- **Side drawer panels** that slide in from any direction (top, bottom, left, right)
- **Multi-language support** with English and French translations
- **Localized interface** with translated navigation labels and UI text
- **Custom themes** with **light** and **dark mode** variants
- **Custom fonts** for headings and body text from external links or local files
- **Toast notifications** with multiple styles: success, error, warning, info, and loading states
- **Alert dialogs** with different button configurations (ok, ok/cancel, ok/cancel/secondary)
- **Modal windows** for displaying content overlays
- **Settings panel** to customize appearance, language preferences, and privacy options
- **Offline support** and **app updates** through service worker
- **Cookie consent management** with categorized privacy controls
- **Error reporting** to help improve app stability
- **Desktop app support** for native applications
- **Responsive design** that adapts to mobile and desktop screens
- Customizable **app branding** with favicon and logo
- **Software updates** with version information and manual update checking in settings
- Customizable **navigation item visibility** for mobile and desktop
