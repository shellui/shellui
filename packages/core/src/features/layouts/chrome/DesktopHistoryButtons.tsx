import { cn } from '../../../lib/utils';
import { DesktopBackButton } from './DesktopBackButton';
import { DesktopForwardButton } from './DesktopForwardButton';

/**
 * Browser-like Back + Forward for Tauri / desktop chrome.
 * `strip` sizes them for the macOS strip (24px boxes, 16px icons).
 */
export function DesktopHistoryButtons({
  className,
  strip = false,
}: {
  className?: string;
  strip?: boolean;
}) {
  const buttonClassName = strip ? 'size-6' : undefined;
  return (
    <div
      data-shellui-no-drag=""
      data-shellui-history=""
      className={cn('flex shrink-0 items-center', className)}
    >
      <DesktopBackButton className={buttonClassName} />
      <DesktopForwardButton className={buttonClassName} />
    </div>
  );
}
