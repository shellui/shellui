import { createContext, useState, createElement, type ReactNode } from 'react';
import { getLogger } from '@shellui/sdk';
import type { ShellUIConfig } from './types';

const logger = getLogger('shellcore');

export interface ConfigContextValue {
  config: ShellUIConfig;
}

export const ConfigContext = createContext<ConfigContextValue | null>(null);

export interface ConfigProviderProps {
  children: ReactNode;
}

// Track if config has been logged to prevent duplicate logs in dev mode
// (can happen with React StrictMode or when app renders in multiple contexts)
let configLogged = false;

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
      let configValue: unknown = __SHELLUI_CONFIG__;
      
      // In development, if __SHELLUI_CONFIG__ is undefined, it might not have been replaced by Vite
      // This can happen if the Vite define configuration isn't working properly
      if (configValue === undefined && typeof window !== 'undefined') {
        // Try to get it from window (fallback for dev mode issues)
        const g = window as unknown as { __SHELLUI_CONFIG__?: unknown };
        if (g.__SHELLUI_CONFIG__ !== undefined) {
          configValue = g.__SHELLUI_CONFIG__;
        }
      }

      // After Vite replacement, configValue will be a JSON string
      // Example: "{\"title\":\"shellui\"}" -> parse -> {title: "shellui"}
      if (configValue !== undefined && configValue !== null && typeof configValue === 'string') {
        try {
          // Parse the JSON string to get the config object
          const parsedConfig: ShellUIConfig = JSON.parse(configValue);
          if (typeof window !== 'undefined' && parsedConfig.runtime === 'tauri') {
            (window as Window & { __SHELLUI_TAURI__?: boolean }).__SHELLUI_TAURI__ = true;
          }

          // Log in dev mode to help debug (only once per page load)
          if (process.env.NODE_ENV === 'development' && !configLogged) {
            configLogged = true;
            logger.info('Config loaded from __SHELLUI_CONFIG__', {
              hasNavigation: !!parsedConfig.navigation,
              navigationItems: parsedConfig.navigation?.length || 0,
            });
          }

          return parsedConfig;
        } catch (parseError) {
          logger.error('Failed to parse config JSON:', { error: parseError });
          logger.error('Config value (first 200 chars):', { value: configValue.substring(0, 200) });
          // Fall through to return empty config
        }
      }

      // Fallback: try to read from globalThis (for edge cases or if define didn't work)
      // This handles cases where Vite's define didn't work or config needs to be injected at runtime
      const g = globalThis as unknown as { __SHELLUI_CONFIG__?: unknown };
      if (typeof g.__SHELLUI_CONFIG__ !== 'undefined' && configValue === undefined) {
        const fallbackValue = g.__SHELLUI_CONFIG__;
        const parsedConfig: ShellUIConfig =
          typeof fallbackValue === 'string'
            ? JSON.parse(fallbackValue)
            : (fallbackValue as ShellUIConfig);
        if (typeof window !== 'undefined' && parsedConfig.runtime === 'tauri') {
          (window as Window & { __SHELLUI_TAURI__?: boolean }).__SHELLUI_TAURI__ = true;
        }

        if (process.env.NODE_ENV === 'development') {
          logger.warn('Config loaded from globalThis fallback (define may not have worked)');
        }

        return parsedConfig;
      }

      // Return empty config if __SHELLUI_CONFIG__ is undefined (fallback for edge cases)
      // This ensures the provider always provides a value, preventing "useConfig must be used within ConfigProvider" errors
      if (process.env.NODE_ENV === 'development') {
        logger.warn(
          'Config not found. Using empty config. Make sure shellui.config.ts is properly loaded and Vite define is configured correctly.',
        );
      }
      return {} as ShellUIConfig;
    } catch (err) {
      logger.error('Failed to load ShellUI config:', { error: err });
      // Don't throw - return empty config instead to prevent app crash
      return {} as ShellUIConfig;
    }
  });

  // Always provide a value - never null - to prevent "useConfig must be used within ConfigProvider" errors
  const value: ConfigContextValue = { config };
  return createElement(ConfigContext.Provider, { value }, props.children);
}
