import ComponentTypes from '@theme-original/NavbarItem/ComponentTypes';
import ServicesDropdownNavbarItem from '@theme/NavbarItem/ServicesDropdownNavbarItem';

// Adds the `custom-servicesDropdown` navbar item type used in docusaurus.config.js.
export default {
  ...ComponentTypes,
  'custom-servicesDropdown': ServicesDropdownNavbarItem,
};
