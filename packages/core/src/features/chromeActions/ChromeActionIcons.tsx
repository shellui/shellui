/**
 * Built-in glyphs for chrome actions (`icon` name).
 * Image / SVG URLs (http(s), data:, absolute or relative paths) render as <img>.
 */

import type { ReactElement } from 'react';

type IconProps = {
  className?: string;
  'data-shellui-chrome-action-animate'?: string;
};

function strokeIcon(
  paths: ReactElement | ReactElement[],
  { className, ...rest }: IconProps,
  size = 20,
): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      {...rest}
    >
      {paths}
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return strokeIcon(<path d="m15 18-6-6 6-6" />, props);
}

export function PlusIcon(props: IconProps) {
  return strokeIcon(
    <>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </>,
    props,
    24,
  );
}

export function MoreHorizontalIcon(props: IconProps) {
  return strokeIcon(
    <>
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
    </>,
    props,
  );
}

export function EditIcon(props: IconProps) {
  return strokeIcon(
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>,
    props,
  );
}

export function ShareIcon(props: IconProps) {
  return strokeIcon(
    <>
      <circle
        cx="18"
        cy="5"
        r="3"
      />
      <circle
        cx="6"
        cy="12"
        r="3"
      />
      <circle
        cx="18"
        cy="19"
        r="3"
      />
      <path d="m8.59 13.51 6.83 3.98" />
      <path d="m15.41 6.51-6.82 3.98" />
    </>,
    props,
  );
}

export function FilterIcon(props: IconProps) {
  return strokeIcon(<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />, props);
}

export function ArchiveIcon(props: IconProps) {
  return strokeIcon(
    <>
      <rect
        width="20"
        height="5"
        x="2"
        y="3"
        rx="1"
      />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </>,
    props,
  );
}

export function SettingsIcon(props: IconProps) {
  return strokeIcon(
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle
        cx="12"
        cy="12"
        r="3"
      />
    </>,
    props,
  );
}

export function DeleteIcon(props: IconProps) {
  return strokeIcon(
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line
        x1="10"
        x2="10"
        y1="11"
        y2="17"
      />
      <line
        x1="14"
        x2="14"
        y1="11"
        y2="17"
      />
    </>,
    props,
  );
}

export function StarIcon(props: IconProps) {
  return strokeIcon(
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
    props,
  );
}

export function RefreshIcon(props: IconProps) {
  return strokeIcon(
    <>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </>,
    props,
  );
}

const BUILTIN: Record<string, (props: IconProps) => ReactElement> = {
  back: ChevronLeftIcon,
  plus: PlusIcon,
  more: MoreHorizontalIcon,
  edit: EditIcon,
  share: ShareIcon,
  filter: FilterIcon,
  archive: ArchiveIcon,
  settings: SettingsIcon,
  delete: DeleteIcon,
  star: StarIcon,
  refresh: RefreshIcon,
};

export function ChromeActionGlyph({
  icon,
  label,
  className,
  animate,
}: {
  icon?: string;
  label?: string;
  className?: string;
  /** When `icon-rotate`, continuously spins the glyph. */
  animate?: string;
}) {
  const spinning = animate === 'icon-rotate';
  const glyphClass = [className ?? 'size-4 shrink-0', spinning ? 'animate-spin' : '']
    .filter(Boolean)
    .join(' ');
  const animateAttr = spinning ? { 'data-shellui-chrome-action-animate': 'icon-rotate' } : {};

  if (!icon) {
    if (!label) return null;
    return (
      <span
        className={`flex items-center justify-center text-xs font-semibold ${glyphClass}`}
        {...animateAttr}
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
        className={`${glyphClass} object-contain`}
        {...animateAttr}
      />
    );
  }

  const Builtin = BUILTIN[icon];
  if (Builtin) {
    return (
      <Builtin
        className={glyphClass}
        {...animateAttr}
      />
    );
  }

  return (
    <span
      className={`flex items-center justify-center text-xs font-semibold ${glyphClass}`}
      {...animateAttr}
    >
      {(label ?? icon).charAt(0).toUpperCase()}
    </span>
  );
}
