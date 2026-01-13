import React, { useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { shellui } from '@shellui/sdk';
import { useConfig } from './features/config/useConfig';
import { ContentView } from './components/ContentView';
import { HomeView } from './components/HomeView';
import { SettingsView } from './components/SettingsView';
import { DefaultLayout } from './features/layouts/DefaultLayout';
import type { NavigationItem } from './features/config/types';
import './index.css';

interface ViewRouteProps {
  navigation: NavigationItem[];
}

const ViewRoute = ({ navigation }: ViewRouteProps) => {
  const location = useLocation();
  const pathname = location.pathname;

  const navItem = useMemo(() => {
    return navigation.find((item) => {
      const pathPrefix = `/${item.path}`;
      return pathname === pathPrefix || pathname.startsWith(`${pathPrefix}/`);
    });
  }, [navigation, pathname]);

  if (!navItem) {
    return <Navigate to="/" replace />;
  }

  // Calculate the relative path from the navItem.path
  // e.g. if item.path is "docs" and pathname is "/docs/intro", subPath is "intro"
  const pathPrefix = `/${navItem.path}`;
  const subPath = pathname.length > pathPrefix.length 
    ? pathname.slice(pathPrefix.length + 1) 
    : '';

  // Construct the final URL for the iframe
  let finalUrl = navItem.url;
  if (subPath) {
    const baseUrl = navItem.url.endsWith('/') ? navItem.url : `${navItem.url}/`;
    finalUrl = `${baseUrl}${subPath}`;
  }

  return <ContentView url={finalUrl} pathPrefix={navItem.path} />;
};

const AppContent = () => {
  const { config, loading, error } = useConfig();

  // Initialize ShellUI SDK to support recursive nesting
  useEffect(() => {
    shellui.init();
  }, []);

  // Extract path from settingsUrl (in case it's a full URL)
  // Must be before conditional returns to follow Rules of Hooks
  const settingsPath = useMemo(() => {
    if (!config.settingsUrl) return null;
    try {
      // If it's a full URL, extract the pathname
      if (config.settingsUrl.startsWith('http://') || config.settingsUrl.startsWith('https://')) {
        const url = new URL(config.settingsUrl);
        return url.pathname;
      }
      // Otherwise, it's already a path
      return config.settingsUrl;
    } catch {
      // If parsing fails, assume it's a path
      return config.settingsUrl;
    }
  }, [config.settingsUrl]);

  // Memoize routes to prevent recreation on every render
  const navigationRoutes = useMemo(
    () =>
      config.navigation?.map((item) => (
        <Route
          key={item.path}
          path={`/${item.path}/*`}
          element={<ViewRoute navigation={config.navigation || []} />}
        />
      )),
    [config.navigation]
  );

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

  return (
    <Routes>
      {settingsPath && <Route path={settingsPath} element={<SettingsView />} />}
      <Route
        element={
          <DefaultLayout 
            title={config.title} 
            navigation={config.navigation || []}
            settingsUrl={config.settingsUrl}
          />
        }
      >
        <Route path="/" element={<HomeView />} />
        {navigationRoutes}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
