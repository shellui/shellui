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
      // __SHELLUI_CONFIG__ is replaced by Vite at build time via define
      // After replacement, it will be a JSON string like: "{\"title\":\"shellui\",...}"
      // Vite's define inserts the string value directly, so we only need to parse once
      // Access it directly (no typeof check) so Vite can statically analyze and replace it
      // @ts-expect-error - __SHELLUI_CONFIG__ is injected by Vite at build time
      const configValue: unknown = __SHELLUI_CONFIG__;
      
      // After Vite replacement, configValue will be a JSON string
      // Example: "{\"title\":\"shellui\"}" -> parse -> {title: "shellui"}
      if (configValue !== undefined && configValue !== null && typeof configValue === 'string') {
        try {
          // Parse the JSON string to get the config object
          const parsedConfig: ShellUIConfig = JSON.parse(configValue);
          
          // Log in dev mode to help debug
          if (process.env.NODE_ENV === 'development') {
            console.log('[ShellUI] Config loaded from __SHELLUI_CONFIG__', {
              hasNavigation: !!parsedConfig.navigation,
              navigationItems: parsedConfig.navigation?.length || 0,
            });
          }
          
          return parsedConfig;
        } catch (parseError) {
          console.error('[ShellUI] Failed to parse config JSON:', parseError);
          console.error('[ShellUI] Config value (first 200 chars):', configValue.substring(0, 200));
          // Fall through to return empty config
        }
      }
      
      // Fallback: try to read from globalThis (for edge cases or if define didn't work)
      const g = globalThis as unknown as { __SHELLUI_CONFIG__?: unknown };
      if (typeof g.__SHELLUI_CONFIG__ !== 'undefined') {
        const fallbackValue = g.__SHELLUI_CONFIG__;
        const parsedConfig: ShellUIConfig =
          typeof fallbackValue === 'string'
            ? JSON.parse(fallbackValue)
            : (fallbackValue as ShellUIConfig);
        
        if (process.env.NODE_ENV === 'development') {
          console.warn('[ShellUI] Config loaded from globalThis fallback (define may not have worked)');
        }
        
        return parsedConfig;
      }
      
      // Return empty config if __SHELLUI_CONFIG__ is undefined (fallback for edge cases)
      console.warn('[ShellUI] Config not found. Using empty config. Make sure shellui.config.ts is properly loaded during build.');
      return {} as ShellUIConfig;
    } catch (err) {
      console.error('[ShellUI] Failed to load ShellUI config:', err);
      // Don't throw - return empty config instead to prevent app crash
      return {} as ShellUIConfig;
    }
  });

  const value: ConfigContextValue = { config };
  return createElement(ConfigContext.Provider, { value }, props.children);
}
