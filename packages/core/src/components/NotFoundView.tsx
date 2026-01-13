export const NotFoundView = () => {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100%',
      flexDirection: 'column',
      color: '#666'
    }}>
      <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 300 }}>404</h1>
      <p style={{ marginTop: '1rem', fontSize: '1.1rem' }}>Page not found</p>
    </div>
  );
};
