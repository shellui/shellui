import { useEffect, useRef, useState } from 'react';
import { shellui } from '@shellui/sdk';
import { Button } from '../../components/ui/button';

/**
 * Compact confirm UI for develop → dynamicSizing demos.
 * Actions stay at the top so they remain reachable after expand.
 * Reports content height to the parent overlay via the SDK.
 *
 * Avoid viewport units (vh/vw/%) in content height — inside a content-sized
 * iframe they create a feedback loop (iframe grows → vh grows → report again).
 */
export function OverlayDynamicDemoView() {
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stop: (() => void) | undefined;
    void shellui.init().then(() => {
      // Observe the content root (grows with children) — not html/body (often height:100%)
      stop = shellui.overlay.autoSize({
        observe: true,
        target: rootRef.current,
      });
    });
    return () => {
      stop?.();
      shellui.overlay.autoSize({ observe: false });
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-overlay-demo-root
      className="h-auto min-h-0 bg-background text-foreground p-5"
    >
      <h1
        className="text-base font-semibold mb-1"
        style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
      >
        Confirm action
      </h1>
      <p className="text-sm text-muted-foreground mb-3">
        This demo uses <code className="text-xs">dynamicSizing</code> so the overlay hugs this
        content. Expand to grow; actions stay above so you can always shrink again.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Hide details' : 'Show more details'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            shellui.closeDrawer();
            shellui.closeModal();
          }}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            shellui.toast({ title: 'Confirmed', type: 'success' });
            shellui.closeDrawer();
            shellui.closeModal();
          }}
        >
          Confirm
        </Button>
      </div>

      {expanded && (
        <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground space-y-3">
          <p className="font-medium text-foreground">Expanded details</p>
          <p>
            The iframe reports height over <code className="text-xs">SHELLUI_OVERLAY_SIZE</code>.
            The parent animates to the new size and clamps to the viewport.
          </p>
          <div className="min-h-[22rem] space-y-3 rounded-md border border-dashed border-border/80 bg-background/60 p-4">
            <p>
              This block is intentionally tall (fixed rem height — not vh) so you can see the
              overlay grow when details open, then shrink when you hide them.
            </p>
            <p>
              Line 2 — keep scrolling in the panel if the viewport max is hit; the shell enables
              inner scroll when height is clamped.
            </p>
            <p>Line 3 — dynamic sizing snaps without size animation (no debounce by default).</p>
            <p>Line 4 — manual resize stays off while dynamicSizing is active.</p>
            <p>Line 5 — use Hide details above to collapse and watch the height animate back.</p>
            <p>Line 6 — Confirm / Cancel remain at the top so they never get clipped away.</p>
            <p>Line 7 — end of sample content.</p>
          </div>
        </div>
      )}
    </div>
  );
}
