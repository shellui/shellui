//! iOS WKWebView host notes for Shellui.
//!
//! Safari Home Screen PWAs get iOS 26/27 Liquid Glass status treatment.
//! Tauri iOS does **not** — the same web UI runs in a native WKWebView, so
//! status chrome is yours via CSS:
//!
//! - `viewport-fit=cover` (already in Shellui `index.html`)
//! - `padding-*: env(safe-area-inset-*)` / `--shellui-safe-area-*`
//!
//! If UIKit still applies automatic scroll-view insets (shrinking the painted
//! surface and exposing a native band), set:
//!
//! ```swift
//! webview.scrollView.contentInsetAdjustmentBehavior = .never
//! ```
//!
//! e.g. via `tauri-plugin-ios-webview-insets` registered before other webview
//! plugins. Detect the live shell in JS with `window.__TAURI__` /
//! Shellui `isTauriRuntime()` — never apply Home Screen PWA-only workarounds
//! inside Tauri.

#![cfg(target_os = "ios")]

/// Placeholder for future iOS-native hooks (insets plugin, status bar style).
/// Safe no-op until an insets plugin or wry API is wired in the generated app.
pub fn install() {
    // Intentionally empty: CSS safe-area + viewport-fit=cover handle the common case.
}
