import { cn } from '../../../lib/utils';
import { DesktopBackButton } from './DesktopBackButton';
import { DesktopForwardButton } from './DesktopForwardButton';

/** Browser-like Back + Forward for Tauri / desktop chrome. */
export function DesktopHistoryButtons({ className }: { className?: string }) {
  return (
    <div
      data-shellui-no-drag=""
      className={cn('flex shrink-0 items-center', className)}
    >
      <DesktopBackButton />
      <DesktopForwardButton />
    </div>
  );
}
