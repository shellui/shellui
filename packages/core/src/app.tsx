import React, { useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { shellui } from '@shellui/sdk';
import { useConfig } from './features/config/useConfig';
import { createAppRouter } from './router/router';
import { SettingsProvider } from './features/settings/SettingsContext';
import { useTheme } from './features/settings/hooks/useTheme';
import './index.css';

const AppContent = () => {
  const { config, loading, error } = useConfig();

  // Initialize ShellUI SDK to support recursive nesting
  useEffect(() => {
    shellui.init();
  }, []);

  // Create router from config using data mode
  const router = useMemo(() => {
    if (!config || loading || error) {
      return null;
    }
    return createAppRouter(config);
  }, [config, loading, error]);

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
  // Apply theme based on settings
  useTheme();
  
  return <AppContent />;
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
