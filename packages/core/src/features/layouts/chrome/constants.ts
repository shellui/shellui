/** Height of the macOS overlay titlebar / traffic-light row. */
export const DESKTOP_TITLEBAR_HEIGHT_PX = 42;

/**
 * Top inset inside the titlebar so web controls optically match macOS traffic lights
 * (lights stay vertically centered in the full height).
 */
export const DESKTOP_TITLEBAR_PAD_TOP_PX = 2;

/** Width reserved for macOS traffic lights (close / minimize / zoom). */
export const MAC_TRAFFIC_LIGHTS_WIDTH_PX = 78;

/** Extra space between traffic lights and the first chrome control. */
export const MAC_TRAFFIC_LIGHTS_GAP_PX = 12;

/** Set on an iframe after it navigates to a foreign origin (login pages, OAuth). */
export const IFRAME_FOREIGN_ATTR = 'data-shellui-iframe-foreign';
