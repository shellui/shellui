import {
  createContext,
  useState,
  createElement,
  type ReactNode,
} from 'react';
import type { ShellUIConfig } from './types';

export interface ConfigContextValue {
  config: ShellUIConfig;
}

export const ConfigContext = createContext<ConfigContextValue | null>(null);

export interface ConfigProviderProps {
  children: ReactNode;
}

/**
 * Loads ShellUI config from __SHELLUI_CONFIG__ (injected by Vite at build time)
 * and provides it via context. Children can use useConfig() to read config.
 */
export function ConfigProvider(props: ConfigProviderProps): ReturnType<typeof createElement> {
  const [config] = useState<ShellUIConfig>(() => {
    try {
      // __SHELLUI_CONFIG__ is replaced by Vite at build time
      const g = globalThis as unknown as { __SHELLUI_CONFIG__?: unknown };
      if (typeof g.__SHELLUI_CONFIG__ !== 'undefined') {
        const configValue = g.__SHELLUI_CONFIG__;
        const parsedConfig: ShellUIConfig =
          typeof configValue === 'string'
            ? JSON.parse(configValue)
            : (configValue as ShellUIConfig);
        return parsedConfig;
      }
    } catch (err) {
      console.error('Failed to load ShellUI config:', err);
      throw err;
    }
  });

  const value: ConfigContextValue = { config };
  return createElement(ConfigContext.Provider, { value }, props.children);
}
