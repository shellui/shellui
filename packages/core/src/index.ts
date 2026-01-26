/**
 * ShellUI Core - Main entry point
 * Exports types and utilities for use in config files and other packages
 */

export type { ShellUIConfig, NavigationItem, NavigationGroup, LocalizedString } from './features/config/types.js';
export { useConfig } from './features/config/useConfig.js';
