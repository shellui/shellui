import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * The one divider used inside the shell panels (see `.shellui-divider` in
 * index.css): a full-width 1px --shellui-hairline, as in the layouts redesign
 * kit. Inside a padded container, pass negative inline margins (e.g. `-mx-2`)
 * so it still runs edge to edge.
 */
export function ShellDivider({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      data-shellui-divider=""
      className={cn('shellui-divider', className)}
      {...props}
    />
  );
}
