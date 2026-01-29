export function LoadingOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-background">
      <div className="h-1 w-full overflow-hidden bg-muted/30">
        <div
          className="h-full w-0 bg-muted-foreground/50"
          style={{ animation: 'loading-bar-slide 400ms linear infinite' }}
        />
      </div>
    </div>
  );
}
