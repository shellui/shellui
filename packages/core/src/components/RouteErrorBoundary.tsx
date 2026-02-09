import { useRouteError, isRouteErrorResponse } from 'react-router';
import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import { Button } from './ui/button';

function isChunkLoadError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('loading dynamically imported module') ||
      msg.includes('chunk') ||
      msg.includes('failed to fetch dynamically imported module')
    );
  }
  return false;
}

function getErrorMessage(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return error.data?.message ?? error.statusText ?? 'Something went wrong';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function getErrorStack(error: unknown): string | null {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  return null;
}

function getErrorDetailsText(error: unknown): string {
  const message = getErrorMessage(error);
  const stack = getErrorStack(error);
  if (stack) {
    return `Message:\n${message}\n\nStack:\n${stack}`;
  }
  return message;
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const { t } = useTranslation('common');
  const isChunkError = isChunkLoadError(error);
  const detailsText = getErrorDetailsText(error);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12"
      style={{ fontFamily: 'var(--heading-font-family, system-ui, sans-serif)' }}
    >
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">
            {isChunkError ? t('errorBoundary.titleChunk') : t('errorBoundary.titleGeneric')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isChunkError
              ? t('errorBoundary.descriptionChunk')
              : t('errorBoundary.descriptionGeneric')}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            variant="default"
            onClick={() => window.location.reload()}
            className="shrink-0"
          >
            {t('errorBoundary.tryAgain')}
          </Button>
          <Button
            variant="outline"
            onClick={() => shellui.navigate('/')}
            className="shrink-0"
          >
            {t('errorBoundary.goToHome')}
          </Button>
        </div>

        <details className="rounded-lg border border-border bg-muted/30 text-left">
          <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground">
            {t('errorBoundary.errorDetails')}
          </summary>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all px-4 pb-3 pt-1 text-xs text-muted-foreground font-mono">
            {detailsText}
          </pre>
        </details>
      </div>
    </div>
  );
}
