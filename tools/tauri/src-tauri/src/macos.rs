//! Native macOS traffic lights are drawn by AppKit, not the webview.
//!
//! Tao and Wry reapply `trafficLightPosition` from their own `drawRect:` and
//! never set the buttons' vertical origin. One position is applied at startup
//! and again at the end of those draws, so resize cannot leave a second spot
//! on screen. Layouts do not move the lights.

#![cfg(target_os = "macos")]

use std::ffi::CStr;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::OnceLock;

use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
use objc2::{msg_send, sel};
use objc2_app_kit::{NSView, NSWindow, NSWindowButton};
use objc2_foundation::NSRect;
use tauri::WebviewWindow;

/// Keep in sync with `DESKTOP_TITLEBAR_HEIGHT_PX`.
const TITLEBAR_HEIGHT: f64 = 42.0;
/// Close button, from the left edge of the window.
const TRAFFIC_LIGHT_X: f64 = 16.0;
/// Extra pixels down from the center of the titlebar. `0` is the sidebar row.
const TRAFFIC_LIGHT_Y: f64 = 0.0;

static WRY_DRAW_RECT: OnceLock<Imp> = OnceLock::new();
static TAO_DRAW_RECT: OnceLock<Imp> = OnceLock::new();
static LOGGED_POSITION: AtomicBool = AtomicBool::new(false);
static BUTTON_GAP_BITS: AtomicU64 = AtomicU64::new(0);

pub fn install(window: &WebviewWindow) {
    hook_draw_rect(c"WryWebViewParent", &WRY_DRAW_RECT, wry_draw_rect);
    hook_draw_rect(c"TaoView", &TAO_DRAW_RECT, tao_draw_rect);
    position(window);
}

fn position(window: &WebviewWindow) {
    let Ok(ptr) = window.ns_window() else {
        return;
    };
    unsafe {
        place_traffic_lights(&*ptr.cast::<NSWindow>());
    }
}

fn hook_draw_rect(class_name: &CStr, slot: &OnceLock<Imp>, hooked: DrawRectImp) {
    if slot.get().is_some() {
        return;
    }
    let Some(class) = AnyClass::get(class_name) else {
        eprintln!("[shellui] {class_name:?} not found; traffic lights stay at the system slot");
        return;
    };
    let methods = class.instance_methods();
    let Some(method) = methods.iter().find(|method| method.name() == sel!(drawRect:)) else {
        eprintln!("[shellui] {class_name:?} drawRect: not found; traffic lights stay at the system slot");
        return;
    };
    let replacement: Imp = unsafe { std::mem::transmute(hooked) };
    let original = unsafe { method.set_implementation(replacement) };
    if slot.set(original).is_ok() {
        eprintln!("[shellui] traffic lights fixed at ({TRAFFIC_LIGHT_X}, {TRAFFIC_LIGHT_Y}) via {class_name:?}");
    }
}

type DrawRectImp = unsafe extern "C-unwind" fn(&AnyObject, Sel, NSRect);

unsafe extern "C-unwind" fn wry_draw_rect(this: &AnyObject, cmd: Sel, dirty: NSRect) {
    finish_draw(WRY_DRAW_RECT.get().copied(), this, cmd, dirty);
}

unsafe extern "C-unwind" fn tao_draw_rect(this: &AnyObject, cmd: Sel, dirty: NSRect) {
    finish_draw(TAO_DRAW_RECT.get().copied(), this, cmd, dirty);
}

unsafe fn finish_draw(original: Option<Imp>, this: &AnyObject, cmd: Sel, dirty: NSRect) {
    if let Some(original) = original {
        let original: DrawRectImp = std::mem::transmute(original);
        original(this, cmd, dirty);
    }
    let window: Option<objc2::rc::Retained<NSWindow>> = msg_send![this, window];
    if let Some(window) = window {
        place_traffic_lights(&window);
    }
}

unsafe fn place_traffic_lights(window: &NSWindow) {
    let Some(close) = window.standardWindowButton(NSWindowButton::CloseButton) else {
        return;
    };
    let Some(miniaturize) = window.standardWindowButton(NSWindowButton::MiniaturizeButton) else {
        return;
    };
    let zoom = window.standardWindowButton(NSWindowButton::ZoomButton);
    let Some(parent) = close.superview() else {
        return;
    };
    let Some(title_bar_container) = parent.superview() else {
        return;
    };

    let close_rect = NSView::frame(&close);
    let measured_gap = NSView::frame(&miniaturize).origin.x - close_rect.origin.x;
    let space_between = if measured_gap > 8.0 {
        BUTTON_GAP_BITS.store(measured_gap.to_bits(), Ordering::Relaxed);
        measured_gap
    } else {
        let cached = f64::from_bits(BUTTON_GAP_BITS.load(Ordering::Relaxed));
        if cached > 8.0 { cached } else { 20.0 }
    };

    let mut title_bar_rect = NSView::frame(&title_bar_container);
    title_bar_rect.size.height = TITLEBAR_HEIGHT;
    title_bar_rect.origin.y = window.frame().size.height - TITLEBAR_HEIGHT;
    title_bar_container.setFrame(title_bar_rect);

    let centered = (TITLEBAR_HEIGHT - close_rect.size.height) / 2.0;
    let flipped: bool = msg_send![&*parent, isFlipped];
    let origin_y = if flipped {
        centered + TRAFFIC_LIGHT_Y
    } else {
        centered - TRAFFIC_LIGHT_Y
    };

    if !LOGGED_POSITION.swap(true, Ordering::Relaxed) {
        eprintln!(
            "[shellui] traffic lights x={TRAFFIC_LIGHT_X} y-offset={TRAFFIC_LIGHT_Y} origin_y={origin_y:.1} flipped={flipped}"
        );
    }

    let mut buttons = vec![close, miniaturize];
    if let Some(zoom) = zoom {
        buttons.push(zoom);
    }
    for (index, button) in buttons.into_iter().enumerate() {
        let mut rect = NSView::frame(&button);
        rect.origin.x = TRAFFIC_LIGHT_X + (index as f64 * space_between);
        rect.origin.y = origin_y;
        button.setFrameOrigin(rect.origin);
    }
}
