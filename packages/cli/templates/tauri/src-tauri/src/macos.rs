//! Native macOS traffic lights are drawn by AppKit, not the webview.
//!
//! Tao and Wry reapply `trafficLightPosition` from `drawRect:` and from
//! `setFrame:` on the titlebar container (including when the window title is
//! set). Those calls never change the buttons' vertical origin, so the first
//! frame stays in the system slot until something else draws. The position is
//! applied again at the end of that `setFrame:` and of titlebar `layout`,
//! before the window is shown.

#![cfg(target_os = "macos")]

use std::ffi::CStr;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};

use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
use objc2::{msg_send, sel, ClassType};
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
static TITLEBAR_SET_FRAME: OnceLock<Option<Imp>> = OnceLock::new();
static LOGGED_POSITION: AtomicBool = AtomicBool::new(false);
static BUTTON_GAP_BITS: AtomicU64 = AtomicU64::new(0);
/// `place_traffic_lights` is on the stack. Nested layout/`setFrame:` must not place again.
static PLACING: AtomicBool = AtomicBool::new(false);

struct LayoutHook {
    class: *const AnyClass,
    /// `None` when the class did not implement `layout` and the hook calls `super`.
    original: Option<Imp>,
}

// The class pointer is a process-lifetime Objective-C class object.
unsafe impl Send for LayoutHook {}

static LAYOUT_HOOKS: Mutex<Vec<LayoutHook>> = Mutex::new(Vec::new());

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
    let Some(method) = methods
        .iter()
        .find(|method| method.name() == sel!(drawRect:))
    else {
        eprintln!(
            "[shellui] {class_name:?} drawRect: not found; traffic lights stay at the system slot"
        );
        return;
    };
    let replacement: Imp = unsafe { std::mem::transmute(hooked) };
    let original = unsafe { method.set_implementation(replacement) };
    if slot.set(original).is_ok() {
        eprintln!("[shellui] traffic lights fixed at ({TRAFFIC_LIGHT_X}, {TRAFFIC_LIGHT_Y}) via {class_name:?}");
    }
}

type DrawRectImp = unsafe extern "C-unwind" fn(&AnyObject, Sel, NSRect);
type SetFrameImp = unsafe extern "C-unwind" fn(&AnyObject, Sel, NSRect);
type LayoutImp = unsafe extern "C-unwind" fn(&AnyObject, Sel);

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

/// Tao resets the titlebar with `setFrame:` and does not set the button origin.
/// Correct the frame before `setFrame:` returns so the first display is final.
unsafe fn hook_titlebar_set_frame(container: &NSView) {
    if TITLEBAR_SET_FRAME.get().is_some() {
        return;
    }
    let class = container.class();
    let sel = sel!(setFrame:);
    let owns = class
        .instance_methods()
        .iter()
        .any(|method| method.name() == sel);
    if owns {
        let Some(method) = class.instance_method(sel) else {
            return;
        };
        let replacement: Imp = std::mem::transmute(titlebar_set_frame as SetFrameImp);
        let original = method.set_implementation(replacement);
        let _ = TITLEBAR_SET_FRAME.set(Some(original));
        return;
    }

    let Some(method) = NSView::class().instance_method(sel) else {
        return;
    };
    let encoding = unsafe { objc2::ffi::method_getTypeEncoding(method) };
    if encoding.is_null() {
        return;
    }
    let imp: Imp = std::mem::transmute(titlebar_set_frame as SetFrameImp);
    let added =
        objc2::ffi::class_addMethod((class as *const AnyClass).cast_mut(), sel, imp, encoding);
    if added.as_bool() {
        let _ = TITLEBAR_SET_FRAME.set(None);
    }
}

unsafe extern "C-unwind" fn titlebar_set_frame(this: &AnyObject, cmd: Sel, frame: NSRect) {
    match TITLEBAR_SET_FRAME.get().copied().flatten() {
        Some(original) => {
            let original: SetFrameImp = std::mem::transmute(original);
            original(this, cmd, frame);
        }
        None => {
            let Some(superclass) = this.class().superclass() else {
                return;
            };
            let _: () = msg_send![super(this, superclass), setFrame: frame];
        }
    }
    if PLACING.load(Ordering::Relaxed) {
        return;
    }
    let window: Option<objc2::rc::Retained<NSWindow>> = msg_send![this, window];
    if let Some(window) = window {
        place_traffic_lights(&window);
    }
}

/// AppKit's titlebar `layout` puts the buttons back in the system slot without a draw.
unsafe fn hook_layout(view: &NSView) {
    let class = view.class();
    let class_ptr = class as *const AnyClass;
    {
        let hooks = LAYOUT_HOOKS
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        if hooks.iter().any(|hook| hook.class == class_ptr) {
            return;
        }
    }

    let sel = sel!(layout);
    let owns = class
        .instance_methods()
        .iter()
        .any(|method| method.name() == sel);
    let original = if owns {
        let Some(method) = class.instance_method(sel) else {
            return;
        };
        let replacement: Imp = std::mem::transmute(layout_hook as LayoutImp);
        Some(method.set_implementation(replacement))
    } else {
        let imp: Imp = std::mem::transmute(layout_hook as LayoutImp);
        let added = objc2::ffi::class_addMethod(
            (class as *const AnyClass).cast_mut(),
            sel,
            imp,
            c"v@:".as_ptr(),
        );
        if !added.as_bool() {
            return;
        }
        None
    };

    let mut hooks = LAYOUT_HOOKS
        .lock()
        .unwrap_or_else(|poison| poison.into_inner());
    if hooks.iter().any(|hook| hook.class == class_ptr) {
        return;
    }
    hooks.push(LayoutHook {
        class: class_ptr,
        original,
    });
}

unsafe extern "C-unwind" fn layout_hook(this: &AnyObject, cmd: Sel) {
    let class_ptr = this.class() as *const AnyClass;
    let original = {
        let hooks = LAYOUT_HOOKS
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        hooks
            .iter()
            .find(|hook| hook.class == class_ptr)
            .map(|hook| hook.original)
    };
    match original {
        Some(Some(original)) => {
            let original: LayoutImp = std::mem::transmute(original);
            original(this, cmd);
        }
        Some(None) => {
            if let Some(superclass) = this.class().superclass() {
                let _: () = msg_send![super(this, superclass), layout];
            }
        }
        None => {}
    }
    if PLACING.load(Ordering::Relaxed) {
        return;
    }
    let window: Option<objc2::rc::Retained<NSWindow>> = msg_send![this, window];
    if let Some(window) = window {
        place_traffic_lights(&window);
    }
}

unsafe fn place_traffic_lights(window: &NSWindow) {
    if PLACING.load(Ordering::Relaxed) {
        return;
    }
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

    hook_titlebar_set_frame(&title_bar_container);
    hook_layout(&parent);
    hook_layout(&title_bar_container);

    let close_rect = NSView::frame(&close);
    let measured_gap = NSView::frame(&miniaturize).origin.x - close_rect.origin.x;
    let space_between = if measured_gap > 8.0 {
        BUTTON_GAP_BITS.store(measured_gap.to_bits(), Ordering::Relaxed);
        measured_gap
    } else {
        let cached = f64::from_bits(BUTTON_GAP_BITS.load(Ordering::Relaxed));
        if cached > 8.0 {
            cached
        } else {
            20.0
        }
    };

    PLACING.store(true, Ordering::Relaxed);

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

    PLACING.store(false, Ordering::Relaxed);
}
