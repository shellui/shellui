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
    const error = new Error(
      'useConfig must be used within a ConfigProvider. ' +
        'Make sure your app is wrapped with <ConfigProvider>.',
    );
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('[ShellUI] ConfigProvider error:', error);
    }
    throw error;
  }
  return context;
}
