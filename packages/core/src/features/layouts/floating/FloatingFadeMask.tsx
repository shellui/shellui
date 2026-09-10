/** Soft edge fades — subtle darken + mask-faded blur hinting at scroll under chrome. */
export function FloatingFadeMask({ placement }: { placement: 'top' | 'bottom' }) {
  return (
    <div
      aria-hidden
      data-shellui-floating-fade={placement}
      className={
        placement === 'top'
          ? 'shellui-floating-fade shellui-floating-fade-top'
          : 'shellui-floating-fade shellui-floating-fade-bottom'
      }
    />
  );
}
