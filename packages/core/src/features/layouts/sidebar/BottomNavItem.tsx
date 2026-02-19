import { Link } from 'react-router';
import { shellui } from '@shellui/sdk';
import type { NavigationItem } from '../../config/types';
import { cn } from '../../../lib/utils';
import { getNavPathPrefix } from '../utils';

export function BottomNavItem({
  item,
  label,
  isActive,
  iconSrc,
  applyIconTheme,
}: {
  item: NavigationItem;
  label: string;
  isActive: boolean;
  iconSrc: string | null;
  applyIconTheme: boolean;
}) {
  const pathPrefix = getNavPathPrefix(item);
  const content = (
    <span className="flex flex-col items-center justify-center gap-1 w-full min-w-0 max-w-full overflow-hidden">
      {iconSrc ? (
        <img
          src={iconSrc}
          alt=""
          className={cn(
            'size-4 shrink-0 rounded-sm object-cover',
            applyIconTheme && 'opacity-90 dark:opacity-100 dark:invert',
          )}
        />
      ) : (
        <span className="size-4 shrink-0 rounded-sm bg-muted" />
      )}
      <span className="text-[11px] leading-tight truncate w-full min-w-0 text-center block">
        {label}
      </span>
    </span>
  );
  const baseClass = cn(
    'flex flex-col items-center justify-center rounded-md py-1.5 px-2 min-w-0 max-w-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    isActive
      ? 'bg-accent text-accent-foreground [&_span]:text-accent-foreground'
      : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground [&_span]:inherit',
  );
  if (item.openIn === 'modal') {
    return (
      <button
        type="button"
        onClick={() => shellui.openModal(item.url)}
        className={baseClass}
      >
        {content}
      </button>
    );
  }
  if (item.openIn === 'drawer') {
    return (
      <button
        type="button"
        onClick={() => shellui.openDrawer({ url: item.url, position: item.drawerPosition })}
        className={baseClass}
      >
        {content}
      </button>
    );
  }
  if (item.openIn === 'external') {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className={baseClass}
      >
        {content}
      </a>
    );
  }
  return (
    <Link
      to={pathPrefix}
      className={baseClass}
    >
      {content}
    </Link>
  );
}
