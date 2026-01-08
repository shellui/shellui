import React, { useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useConfig } from '../features/config/useConfig';
import { ContentView } from './components/ContentView';
import { DefaultLayout } from '../features/layouts/DefaultLayout';
import type { NavigationItem } from '../features/config/types';
import './index.css';

const Home = () => {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100%',
      flexDirection: 'column',
      color: '#666'
    }}>
      <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 300 }}>Welcome to ShellUI</h1>
      <p style={{ marginTop: '1rem', fontSize: '1.1rem' }}>Select a navigation item to get started.</p>
    </div>
  );
};

interface ViewRouteProps {
  navigation: NavigationItem[];
}

const ViewRoute = ({ navigation }: ViewRouteProps) => {
  const location = useLocation();
  const currentPath = location.pathname.slice(1);
  const navItem = useMemo(
    () => navigation.find(item => item.path === currentPath),
    [navigation, currentPath]
  );

  if (!navItem) {
    return <Navigate to="/" replace />;
  }

  return <ContentView url={navItem.url} />;
};

const AppContent = () => {
  const { config, loading, error } = useConfig();

  // Memoize routes to prevent recreation on every render
  const navigationRoutes = useMemo(
    () =>
      config.navigation?.map((item) => (
        <Route
          key={item.path}
          path={`/${item.path}`}
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
      <Route
        element={
          <DefaultLayout 
            title={config.title} 
            navigation={config.navigation || []} 
          />
        }
      >
        <Route path="/" element={<Home />} />
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
