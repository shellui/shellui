import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { ThemeAsset } from '../../config/types';
import { cn } from '../../../lib/utils';
import { isThemeAssetPair, resolveThemeAsset } from './resolveThemeAsset';

function useDocumentIsDark(): boolean {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false,
  );

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export interface AppBrandIconProps {
  appIcon?: ThemeAsset;
  /** Accessible name / link title (usually config.title). */
  title?: string;
  className?: string;
  /** Extra class on the <img> (layout-specific theming hooks). */
  imgClassName?: string;
  /** When false, render the image only (no home link). Default true. */
  linkToHome?: boolean;
  /** Forwarded to the link/wrapper (e.g. data-shellui-no-drag for Tauri). */
  'data-shellui-no-drag'?: string;
}

/**
 * Small square brand mark from config.appIcon.
 * Single-path assets are recolored for light/dark via CSS; `{ light, dark }` pairs swap files.
 */
export function AppBrandIcon({
  appIcon,
  title,
  className,
  imgClassName,
  linkToHome = true,
  'data-shellui-no-drag': noDrag,
}: AppBrandIconProps) {
  const isDark = useDocumentIsDark();
  const mode = isDark ? 'dark' : 'light';
  const src = resolveThemeAsset(appIcon, mode);
  if (!src) return null;

  const paired = isThemeAssetPair(appIcon);
  const alt = title?.trim() || 'Home';
  const noDragProps = noDrag !== undefined ? { 'data-shellui-no-drag': noDrag } : undefined;

  const image = (
    <img
      src={src}
      alt={alt}
      className={cn(
        'size-5 shrink-0 object-contain',
        paired ? 'app-brand-icon-static' : 'app-brand-icon',
        imgClassName,
      )}
    />
  );

  if (!linkToHome) {
    return (
      <span
        className={cn('inline-flex shrink-0 items-center', className)}
        {...noDragProps}
      >
        {image}
      </span>
    );
  }

  return (
    <Link
      to="/"
      title={alt}
      aria-label={alt}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        className,
      )}
      {...noDragProps}
    >
      {image}
    </Link>
  );
}
