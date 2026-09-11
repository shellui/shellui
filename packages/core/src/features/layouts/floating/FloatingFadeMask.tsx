/** Soft edge fades — mask-tapered blur so scrolling content softens toward chrome. */
export function FloatingFadeMask({
  placement,
  visible,
}: {
  placement: 'top' | 'bottom';
  /** False at the matching scroll edge (top/bottom) or when content does not overflow. */
  visible: boolean;
}) {
  return (
    <div
      aria-hidden
      data-shellui-floating-fade={placement}
      data-visible={visible ? 'true' : 'false'}
      className={
        placement === 'top'
          ? 'shellui-floating-fade shellui-floating-fade-top'
          : 'shellui-floating-fade shellui-floating-fade-bottom'
      }
    />
  );
}
