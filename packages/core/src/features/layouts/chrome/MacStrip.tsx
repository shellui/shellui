import { cn } from '../../../lib/utils';

/** Drag attributes for strip backgrounds and flexible spacers. */
export const MAC_DRAG_REGION_PROPS = {
  'data-shellui-drag-region': '',
  'data-tauri-drag-region': '',
} as const;

/**
 * Left safe area of the macOS strip: 80px next to the default traffic lights
 * (12px in native fullscreen). Drag only, never holds a control.
 */
export function MacLightsSafeArea({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      data-shellui-mac-safe=""
      {...MAC_DRAG_REGION_PROPS}
      className={cn('shellui-mac-safe h-full shrink-0', className)}
    />
  );
}

/** Flexible drag spacer inside the macOS strip. */
export function MacStripSpacer({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      {...MAC_DRAG_REGION_PROPS}
      className={cn('min-h-full min-w-2 flex-1 self-stretch', className)}
    />
  );
}
