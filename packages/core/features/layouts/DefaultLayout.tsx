import { Link, useLocation, Outlet } from 'react-router-dom';
import type { NavigationItem } from '../config/types';

interface DefaultLayoutProps {
  title?: string;
  navigation: NavigationItem[];
}

export const DefaultLayout = ({ title, navigation }: DefaultLayoutProps) => {
  const location = useLocation();

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif',
        margin: 0,
        padding: 0,
        overflow: 'hidden'
      }}
    >
      {/* Left Sidebar */}
      <aside
        style={{
          width: '250px',
          backgroundColor: '#f8f9fa',
          borderRight: '1px solid #e0e0e0',
          display: 'flex',
          flexDirection: 'column',
          padding: '1rem 0',
          overflowY: 'auto'
        }}
      >
        {title && (
          <div style={{ padding: '0 1rem 1rem 1rem', borderBottom: '1px solid #e0e0e0', marginBottom: '1rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#333' }}>
              {title}
            </h1>
          </div>
        )}
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0 0.5rem' }}>
          {navigation.map((item) => {
            const isActive = location.pathname === `/${item.path}`;
            return (
              <Link
                key={item.path}
                to={`/${item.path}`}
                style={{
                  padding: '0.75rem 1rem',
                  textDecoration: 'none',
                  color: isActive ? '#0066cc' : '#666',
                  backgroundColor: isActive ? '#e3f2fd' : 'transparent',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.2s ease',
                  display: 'block',
                  borderLeft: isActive ? '3px solid #0066cc' : '3px solid transparent'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = '#f0f0f0';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: '#fff'
        }}
      >
        <Outlet />
      </main>
    </div>
  );
};
