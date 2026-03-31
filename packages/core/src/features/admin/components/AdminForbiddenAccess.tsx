export const AdminForbiddenAccess = () => {
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Access forbidden</h1>
        <p className="mt-2 text-sm text-muted-foreground">Contact your administrator.</p>
      </div>
    </div>
  );
};
