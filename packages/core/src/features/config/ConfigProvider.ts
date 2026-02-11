import { createContext, useState, createElement, type ReactNode } from 'react';
import type { ComponentType } from 'react';
import { getLogger } from '@shellui/sdk';
import type { ShellUIConfig } from './types';
import shelluiConfig, { shelluiComponents } from '@shellui/config';

const logger = getLogger('shellcore');

export interface ConfigContextValue {
  config: ShellUIConfig;
  /** Map of nav path -> component for /__app/:path (injected when componentPath is set in config). */
  shelluiComponents: Record<string, ComponentType>;
}

export const ConfigContext = createContext<ConfigContextValue | null>(null);

export interface ConfigProviderProps {
  children: ReactNode;
}

// Track if config has been logged to prevent duplicate logs in dev mode
// (can happen with React StrictMode or when app renders in multiple contexts)
let configLogged = false;

/**
 * Provides ShellUI config (loaded from @shellui/config at build time) via context.
 * Children can use useConfig() to read config.
 */
export function ConfigProvider(props: ConfigProviderProps): ReturnType<typeof createElement> {
  const [config] = useState<ShellUIConfig>(() => {
    try {
      const resolved = shelluiConfig ?? ({} as ShellUIConfig);
      if (typeof window !== 'undefined' && resolved.runtime === 'tauri') {
        (window as Window & { __SHELLUI_TAURI__?: boolean }).__SHELLUI_TAURI__ = true;
      }
      if (process.env.NODE_ENV === 'development' && !configLogged) {
        configLogged = true;
        logger.info('Config loaded from @shellui/config', {
          hasNavigation: !!resolved.navigation,
          navigationItems: resolved.navigation?.length || 0,
        });
      }
      return resolved;
    } catch (err) {
      logger.error('Failed to load ShellUI config:', { error: err });
      return {} as ShellUIConfig;
    }
  });

  const value: ConfigContextValue = {
    config,
    shelluiComponents: typeof shelluiComponents !== 'undefined' ? shelluiComponents : {},
  };
  return createElement(ConfigContext.Provider, { value }, props.children);
}
