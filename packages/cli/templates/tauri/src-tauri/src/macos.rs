//! Native macOS traffic lights are drawn by AppKit, not the webview.
//!
//! Wry reapplies `trafficLightPosition` in `WryWebViewParent::drawRect` and
//! never sets the buttons' vertical origin, so one-shot positioning is
//! overwritten on the next paint. We patch that `drawRect:` and then center
//! the lights in the 38px chrome row.

#![cfg(target_os = "macos")]

use std::ffi::CStr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
use objc2::{msg_send, sel};
use objc2_app_kit::{NSView, NSWindow, NSWindowButton};
use objc2_foundation::NSRect;
use tauri::WebviewWindow;

/// Keep in sync with `DESKTOP_TITLEBAR_HEIGHT_PX` in the sidebar chrome.
pub const TITLEBAR_HEIGHT: f64 = 38.0;
pub const INSET_X: f64 = 16.0;

static ORIGINAL_DRAW_RECT: OnceLock<Imp> = OnceLock::new();
static LOGGED_POSITION: AtomicBool = AtomicBool::new(false);

pub fn install(window: &WebviewWindow) {
    hook_wry_draw_rect();
    position(window);
}

fn position(window: &WebviewWindow) {
    let Ok(ptr) = window.ns_window() else {
        return;
    };
    unsafe {
        inset_traffic_lights(&*ptr.cast::<NSWindow>(), INSET_X, TITLEBAR_HEIGHT);
    }
}

fn hook_wry_draw_rect() {
    if ORIGINAL_DRAW_RECT.get().is_some() {
        return;
    }
    let Some(class) = AnyClass::get(CStr::from_bytes_with_nul(b"WryWebViewParent\0").unwrap())
    else {
        eprintln!("[shellui] WryWebViewParent not found; traffic lights will not be recentered");
        return;
    };
    let methods = class.instance_methods();
    let Some(method) = methods.iter().find(|method| method.name() == sel!(drawRect:)) else {
        eprintln!("[shellui] WryWebViewParent drawRect: not found; traffic lights will not be recentered");
        return;
    };
    let hooked: Imp = unsafe { std::mem::transmute(hooked_draw_rect as DrawRectImp) };
    let original = unsafe { method.set_implementation(hooked) };
    if ORIGINAL_DRAW_RECT.set(original).is_ok() {
        eprintln!("[shellui] traffic-light aligner hooked (centered in {TITLEBAR_HEIGHT}px bar)");
    }
}

type DrawRectImp = unsafe extern "C-unwind" fn(&AnyObject, Sel, NSRect);

unsafe extern "C-unwind" fn hooked_draw_rect(this: &AnyObject, cmd: Sel, dirty: NSRect) {
    if let Some(original) = ORIGINAL_DRAW_RECT.get().copied() {
        let original: DrawRectImp = std::mem::transmute(original);
        original(this, cmd, dirty);
    }
    let window: Option<objc2::rc::Retained<NSWindow>> = unsafe { msg_send![this, window] };
    if let Some(window) = window {
        unsafe { inset_traffic_lights(&window, INSET_X, TITLEBAR_HEIGHT) };
    }
}

unsafe fn inset_traffic_lights(window: &NSWindow, x: f64, titlebar_height: f64) {
    let Some(close) = window.standardWindowButton(NSWindowButton::CloseButton) else {
        return;
    };
    let Some(miniaturize) = window.standardWindowButton(NSWindowButton::MiniaturizeButton) else {
        return;
    };
    let zoom = window.standardWindowButton(NSWindowButton::ZoomButton);

    let Some(title_bar_container) = close.superview().and_then(|view| view.superview()) else {
        return;
    };

    let close_rect = NSView::frame(&close);
    let mut title_bar_rect = NSView::frame(&title_bar_container);
    title_bar_rect.size.height = titlebar_height;
    title_bar_rect.origin.y = window.frame().size.height - titlebar_height;
    title_bar_container.setFrame(title_bar_rect);

    let space_between = NSView::frame(&miniaturize).origin.x - close_rect.origin.x;
    let origin_y = ((titlebar_height - close_rect.size.height) / 2.0).max(0.0);

    if !LOGGED_POSITION.swap(true, Ordering::Relaxed) {
        eprintln!(
            "[shellui] traffic lights origin_y={origin_y:.1}px in {titlebar_height}px bar (button h={:.1})",
            close_rect.size.height
        );
    }

    let mut buttons = vec![close, miniaturize];
    if let Some(zoom) = zoom {
        buttons.push(zoom);
    }

    for (index, button) in buttons.into_iter().enumerate() {
        let mut rect = NSView::frame(&button);
        rect.origin.x = x + (index as f64 * space_between);
        rect.origin.y = origin_y;
        button.setFrameOrigin(rect.origin);
    }
}
