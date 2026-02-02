import React, { useMemo, useLayoutEffect, useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { shellui } from '@shellui/sdk';
import { useConfig } from './features/config/useConfig';
import { ConfigProvider } from './features/config/ConfigProvider';
import { createAppRouter } from './router/router';
import { SettingsProvider } from './features/settings/SettingsProvider';
import { ThemeProvider } from './features/theme/ThemeProvider';
import { I18nProvider } from './i18n/I18nProvider';
import './i18n/config'; // Initialize i18n
import './index.css';

const AppContent = () => {
  const { config } = useConfig();

  // Sync document title with config
  useEffect(() => {
    if (config?.title) {
      document.title = config.title;
    }
  }, [config?.title]);

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

const App = () => {

  const [isLoading, setIsLoading] = useState(true);
  // Initialize ShellUI SDK to support recursive nesting
  useLayoutEffect(() => {
    shellui.init().then(() => {
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <ConfigProvider>
      <SettingsProvider>
        <ThemeProvider>
          <I18nProvider>
            <AppContent />
          </I18nProvider>
        </ThemeProvider>
      </SettingsProvider>
    </ConfigProvider>
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
