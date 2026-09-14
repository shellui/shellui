/**
 * Built-in glyphs for chrome actions (`icon` name).
 * Icon URLs are rendered as <img>; unknown names fall back to a letter.
 */

import type { ReactElement } from 'react';

type IconProps = { className?: string };

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
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
      className={className}
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

export function MoreHorizontalIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
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
    </svg>
  );
}

const BUILTIN: Record<string, (props: IconProps) => ReactElement> = {
  back: ChevronLeftIcon,
  plus: PlusIcon,
  more: MoreHorizontalIcon,
};

export function ChromeActionGlyph({
  icon,
  label,
  className,
}: {
  icon?: string;
  label?: string;
  className?: string;
}) {
  if (!icon) {
    if (!label) return null;
    return (
      <span
        className={className ?? 'flex size-5 items-center justify-center text-xs font-semibold'}
      >
        {label.charAt(0).toUpperCase()}
      </span>
    );
  }

  if (/^(https?:|data:|\/|\.)/.test(icon) || icon.includes('/')) {
    return (
      <img
        src={icon}
        alt=""
        className={className ?? 'size-5 object-contain'}
      />
    );
  }

  const Builtin = BUILTIN[icon];
  if (Builtin) return <Builtin className={className} />;

  return (
    <span className={className ?? 'flex size-5 items-center justify-center text-xs font-semibold'}>
      {(label ?? icon).charAt(0).toUpperCase()}
    </span>
  );
}
