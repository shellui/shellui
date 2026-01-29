import React, { useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { shellui } from '@shellui/sdk';
import { useConfig } from './features/config/useConfig';
import { createAppRouter } from './router/router';
import { SettingsProvider } from './features/settings/SettingsProvider';
import { useTheme } from './features/theme/useTheme';
import { I18nProvider } from './i18n/I18nProvider';
import type { ShellUIConfig } from './features/config/types';
import './i18n/config'; // Initialize i18n
import './index.css';

const AppContent = ({ config }: { config: ShellUIConfig }) => {
  // Initialize ShellUI SDK to support recursive nesting
  useEffect(() => {
    shellui.init();
  }, []);

  // Create router from config using data mode
  const router = useMemo(() => {
    if (!config) {
      return null;
    }
    return createAppRouter(config);
  }, [config]);

  // If no navigation, show simple layout
  if (!config.navigation || config.navigation.length === 0) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
        <h1>{config.title || 'ShellUI'}</h1>
        <p>No navigation items configured.</p>
      </div>
    );
  }

  if (!router) {
    return null;
  }

  return <RouterProvider router={router} />;
};

const AppWithTheme = () => {
  const { config, loading, error } = useConfig();
  // Apply theme based on settings
  useTheme();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <p>Loading configuration...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <p style={{ color: 'red' }}>Error loading configuration: {error.message}</p>
      </div>
    );
  }

  return (
    <I18nProvider config={config}>
      <AppContent config={config} />
    </I18nProvider>
  );
};

const App = () => {
  return (
    <SettingsProvider>
      <AppWithTheme />
    </SettingsProvider>
  );
};

export default App;

// Store root instance to handle HMR properly
// Use window to persist across HMR reloads
const container = document.getElementById('root')!;
const root = (window as any).__shellui_root__ || ReactDOM.createRoot(container);

if (!(window as any).__shellui_root__) {
  (window as any).__shellui_root__ = root;
}

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
