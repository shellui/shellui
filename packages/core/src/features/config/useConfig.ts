import { useContext } from 'react';
import { ConfigContext, type ConfigContextValue } from './ConfigProvider';

/**
 * Hook to access ShellUI configuration from ConfigProvider context.
 * Must be used within a ConfigProvider.
 * @returns {ConfigContextValue} Configuration object and loading state
 */
export function useConfig(): ConfigContextValue {
  const context = useContext(ConfigContext);
  if (context === null) {
    // This error should never happen if ConfigProvider is properly wrapping the app
    // If you see this error, check that:
    // 1. Your component is rendered inside a <ConfigProvider> tree
    // 2. The ConfigProvider is mounted before components that use useConfig()
    // 3. Vite's define configuration is working correctly (check __SHELLUI_CONFIG__)
    const error = new Error(
      'useConfig must be used within a ConfigProvider. ' +
      'Make sure your app is wrapped with <ConfigProvider> and that Vite define is configured correctly.'
    );
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.error('[ShellUI] ConfigProvider error:', error);
      console.error('[ShellUI] Check that __SHELLUI_CONFIG__ is defined:', typeof (window as any).__SHELLUI_CONFIG__);
    }
    throw error;
  }
  return context;
}
