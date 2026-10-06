import React from 'react';
import clsx from 'clsx';
import {isRegexpStringMatch} from '@docusaurus/theme-common';
import {useLocalPathname} from '@docusaurus/theme-common/internal';
import DropdownNavbarItem from '@theme/NavbarItem/DropdownNavbarItem';

/**
 * The "Services" navbar dropdown. Each entry links to one service docs instance
 * and carries an `activeBaseRegex` that matches its route prefix. When the
 * current page belongs to a service, the dropdown takes that service's label,
 * is styled active, and highlights the matching entry. Works on desktop and in
 * the mobile navbar sidebar.
 */
export default function ServicesDropdownNavbarItem({
  label = 'Services',
  items = [],
  className,
  mobile = false,
  ...props
}) {
  const localPathname = useLocalPathname();
  const activeItem = items.find((item) =>
    isRegexpStringMatch(item.activeBaseRegex, localPathname),
  );
  const activeClassName = mobile ? 'menu__link--active' : 'dropdown__link--active';

  return (
    <DropdownNavbarItem
      {...props}
      mobile={mobile}
      label={activeItem ? activeItem.label : label}
      className={clsx(
        'navbar__services-dropdown',
        activeItem && (mobile ? 'menu__link--active' : 'navbar__link--active'),
        className,
      )}
      items={items.map((item) =>
        item === activeItem
          ? {
              ...item,
              className: clsx(item.className, activeClassName),
            }
          : item,
      )}
    />
  );
}
