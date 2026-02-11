/**
 * Type declaration for the virtual @shellui/config module.
 * The CLI injects this module at build time via Vite (virtual:shellui-config).
 */
declare module '@shellui/config' {
  import type { ShellUIConfig } from './types';
  export const shelluiConfig: ShellUIConfig;
  export default shelluiConfig;
}
