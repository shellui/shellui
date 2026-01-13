export const HomeView = () => {
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
