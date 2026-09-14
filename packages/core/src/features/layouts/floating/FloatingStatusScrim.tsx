import { isShellUiRootWindow } from '../chrome/SafeAreaTopbar';

/** Fade length below the status-bar band into content. */
const STATUS_SCRIM_FADE_PX = 28;

/**
 * iPhone / notch: tint over the safe-area top when there is no top action chrome
 * (action bar owns its own scrim). No backdrop-blur — it fights animations.
 * Only on the outermost shell window (host already clears nested iframes).
 */
export function FloatingStatusScrim({ enabled }: { enabled: boolean }) {
  if (!enabled || !isShellUiRootWindow()) return null;

  return (
    <div
      aria-hidden
      data-shellui-floating-status-scrim=""
      className="pointer-events-none absolute inset-x-0 top-0 z-[44]"
    >
      <div
        className="bg-background/80"
        style={{ height: 'var(--shellui-safe-area-top, 0px)' }}
      />
      <div
        className="bg-gradient-to-b from-background/80 to-transparent"
        style={{ height: STATUS_SCRIM_FADE_PX }}
      />
    </div>
  );
}
