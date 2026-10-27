/**
 * macOS overlay strip height (rules v2). The traffic lights stay at the AppKit default
 * (`trafficLightPosition` unset): 32px title bar on macOS 26, 28px on macOS 15.
 * Every macOS desktop layout puts its top chrome in this one strip.
 */
export const DESKTOP_TITLEBAR_HEIGHT_PX = 32;

/** Top inset inside the macOS strip. Controls centre on the lights line, no nudge. */
export const DESKTOP_TITLEBAR_PAD_TOP_PX = 0;

/** Vertical centre of the default traffic lights in the strip (`--shellui-mac-lights-cy`). */
export const MAC_TRAFFIC_LIGHTS_CENTER_Y_PX = 16;

/** Width reserved for the default traffic lights (group spans about x 8 to 64). */
export const MAC_TRAFFIC_LIGHTS_WIDTH_PX = 68;

/** Extra space between traffic lights and the first chrome control. */
export const MAC_TRAFFIC_LIGHTS_GAP_PX = 12;

/**
 * Drag-only safe area from the left window edge (`--shellui-mac-lights-safe`).
 * Nothing interactive, no text and no focus ring enters 0 to 80 x 0 to 32.
 */
export const MAC_LIGHTS_SAFE_PX = MAC_TRAFFIC_LIGHTS_WIDTH_PX + MAC_TRAFFIC_LIGHTS_GAP_PX;

/** Safe area in native fullscreen, where AppKit hides the lights. */
export const MAC_LIGHTS_SAFE_FULLSCREEN_PX = 12;

/** Controls in the macOS strip: 24px boxes with 16px icons. */
export const MAC_STRIP_CONTROL_PX = 24;

/**
 * Shell header height on the web, on phones and on Tauri hosts with a native caption bar
 * (Windows, Linux). The macOS strip uses `DESKTOP_TITLEBAR_HEIGHT_PX` instead.
 */
export const SHELL_HEADER_HEIGHT_PX = 42;

/** Top inset inside the shell header (web, phones, native caption bar hosts). */
export const SHELL_HEADER_PAD_TOP_PX = 2;

/** Set on an iframe after it navigates to a foreign origin (login pages, OAuth). */
export const IFRAME_FOREIGN_ATTR = 'data-shellui-iframe-foreign';
