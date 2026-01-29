import { useContext } from 'react';
import { ConfigContext, ConfigContextValue } from './ConfigProvider';

/**
 * Hook to access ShellUI configuration from ConfigProvider context.
 * Must be used within a ConfigProvider.
 * @returns {ConfigContextValue} Configuration object and loading state
 */
export function useConfig(): ConfigContextValue {
  const context = useContext(ConfigContext);
  if (context === null) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}
