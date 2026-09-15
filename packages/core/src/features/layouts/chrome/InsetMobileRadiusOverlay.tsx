/**
 * Mobile inset “card” personality without resizing the iframe.
 *
 * Paints chrome-colored corner wedges + a top radius/border over full-bleed
 * content via a box-shadow cutout. Clicks pass through. Hides with the top bar
 * on scroll so flush-style stable `--shellui-inset-top` stays smooth.
 */
export function InsetMobileRadiusOverlay({ chromeVisible }: { chromeVisible: boolean }) {
  return (
    <div
      aria-hidden
      data-shellui-inset-radius-overlay=""
      data-chrome-visible={chromeVisible ? 'true' : 'false'}
      className="pointer-events-none absolute inset-0 z-[45] md:hidden"
    >
      <div data-shellui-inset-radius-cutout="" />
    </div>
  );
}
