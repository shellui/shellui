interface ContentViewProps {
  url: string;
}

export const ContentView = ({ url }: ContentViewProps) => {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex' }}>
      <iframe 
        key={url}
        src={url}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block'
        }}
        title="Content Frame"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
};
