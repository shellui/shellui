import { cn } from '../../../lib/utils';
import { isAppIcon } from './sidebarUtils';

/** Inline SVG: external-link icon. Bundled so consumers don't need to serve static SVGs. */
export function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line
        x1="10"
        y1="14"
        x2="21"
        y2="3"
      />
    </svg>
  );
}

/** Default nav icon when a navigation item has no custom icon. */
export function DefaultNavIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="8"
      />
    </svg>
  );
}

/**
 * Nav icon that follows sidebar text color (including hover / active).
 * Local `/icons/*.svg` use a CSS mask + `currentColor`; external images stay as `<img>`.
 */
export function NavIcon({ src, className }: { src?: string | null; className?: string }) {
  if (!src) {
    return <DefaultNavIcon className={className} />;
  }

  if (isAppIcon(src)) {
    return (
      <span
        aria-hidden
        className={cn('size-4 shrink-0 bg-current', className)}
        style={{
          maskImage: `url("${src}")`,
          WebkitMaskImage: `url("${src}")`,
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskPosition: 'center',
        }}
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={cn('size-4 shrink-0', className)}
    />
  );
}
