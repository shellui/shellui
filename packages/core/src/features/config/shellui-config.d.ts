/**
 * Type declaration for the virtual @shellui/config module.
 * The CLI injects this module at build time via Vite (virtual:shellui-config).
 * When nav items have componentPath, the CLI also injects shelluiComponents for /__app/:path routes.
 */
declare module '@shellui/config' {
  import type { ComponentType } from 'react';
  import type { ShellUIConfig } from './types';
  export const shelluiConfig: ShellUIConfig;
  /** Map of nav path -> component for component-based items (injected when componentPath is set). */
  export const shelluiComponents: Record<string, ComponentType>;
  export default shelluiConfig;
}
