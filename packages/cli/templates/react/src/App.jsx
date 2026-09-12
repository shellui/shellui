import { useState, useEffect } from 'react';
import shellui from '@shellui/sdk';

function App() {
  const [settings, setSettings] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Initialize Shellui SDK
    shellui.ready().then(() => {
      // Get settings from parent shell
      const shellSettings = shellui.getSettings();
      setSettings(shellSettings);

      // Get current user if authenticated
      const currentUser = shellui.getUser();
      setUser(currentUser);

      console.log('Shellui SDK initialized', { settings: shellSettings, user: currentUser });
    });
  }, []);

  const handleShowToast = () => {
    shellui.showToast({
      title: 'Hello from React!',
      description: 'This is a toast notification from your React app.',
    });
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Welcome to Shellui + React</h1>

      <div style={{ marginTop: '2rem' }}>
        <h2>Getting Started</h2>
        <p>This is a minimal React starter integrated with the Shellui SDK.</p>

        <div style={{ marginTop: '1rem' }}>
          <button
            onClick={handleShowToast}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
            }}
          >
            Show Toast
          </button>
        </div>
      </div>

      {settings && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Shell Settings</h3>
          <pre
            style={{
              backgroundColor: '#f5f5f5',
              padding: '1rem',
              borderRadius: '0.25rem',
              overflow: 'auto',
            }}
          >
            {JSON.stringify(settings, null, 2)}
          </pre>
        </div>
      )}

      {user && (
        <div style={{ marginTop: '1rem' }}>
          <h3>Current User</h3>
          <pre
            style={{
              backgroundColor: '#f5f5f5',
              padding: '1rem',
              borderRadius: '0.25rem',
              overflow: 'auto',
            }}
          >
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default App;
