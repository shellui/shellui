import { cn } from '../../../lib/utils';
import { isAppIcon } from './sidebarUtils';

/** Inline SVG: external link (arrow up right). Bundled so consumers don't need to serve static SVGs. */
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
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

function LucideSvg({ className, children }: { className?: string; children: React.ReactNode }) {
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
      {children}
    </svg>
  );
}

/** lucide x */
export function CloseIcon({ className }: { className?: string }) {
  return (
    <LucideSvg className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </LucideSvg>
  );
}

/** lucide ellipsis */
export function EllipsisIcon({ className }: { className?: string }) {
  return (
    <LucideSvg className={className}>
      <circle
        cx="12"
        cy="12"
        r="1"
      />
      <circle
        cx="19"
        cy="12"
        r="1"
      />
      <circle
        cx="5"
        cy="12"
        r="1"
      />
    </LucideSvg>
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
