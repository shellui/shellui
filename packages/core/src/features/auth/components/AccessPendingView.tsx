import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';

type Props = {
  message?: string | null;
  code?: string | null;
  onBackToLogin: () => void;
};

type AccessState = 'pending' | 'denied';

function resolveState(code: string | null | undefined): AccessState {
  return code === 'access_denied' ? 'denied' : 'pending';
}

/**
 * Shown when OAuth identity succeeded but company policy blocks tokens.
 * Intentionally not framed as a technical failure.
 */
export const AccessPendingView = ({ message, code, onBackToLogin }: Props) => {
  const state = resolveState(code);
  const isDenied = state === 'denied';

  const statusLabel = isDenied ? 'Organization policy' : 'Pending approval';
  const title = isDenied
    ? 'Access is not available for your account'
    : 'Your account is awaiting approval';
  const lead = isDenied
    ? 'Your sign-in was verified, but this organization only admits users from approved email domains. Your domain is not on that list.'
    : 'Your sign-in was verified. This organization requires an administrator to enable new accounts before you can continue.';
  const nextSteps = isDenied
    ? 'An administrator has been notified. If you believe you should have access, contact your organization admin — they can enable your membership.'
    : 'An administrator has been notified and will review your request. You will receive an email when access is enabled.';

  const backendDetail = message?.trim() || null;
  const showBackendDetail =
    Boolean(backendDetail) &&
    !backendDetail!.toLowerCase().includes('waiting for an administrator') &&
    !backendDetail!.toLowerCase().includes('email domain is not authorized');

  return (
    <main className="flex min-h-full items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-xl animate-in fade-in-0 slide-in-from-bottom-3 duration-500">
        <section
          className="border border-border bg-card"
          aria-labelledby="access-status-title"
        >
          <header className="border-b border-border px-8 py-6">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  'inline-flex items-center gap-2 border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em]',
                  isDenied
                    ? 'border-foreground/25 bg-muted text-foreground'
                    : 'border-foreground/20 bg-background text-foreground',
                )}
              >
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    isDenied ? 'bg-foreground/70' : 'bg-foreground',
                  )}
                  aria-hidden
                />
                {statusLabel}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {isDenied ? 'Ref. access_denied' : 'Ref. access_pending'}
              </span>
            </div>
            <h1
              id="access-status-title"
              className="mt-5 text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]"
            >
              {title}
            </h1>
          </header>

          <div className="space-y-5 px-8 py-6">
            <p className="text-[15px] leading-relaxed text-foreground/90">{lead}</p>

            <div className="border border-border bg-muted/30 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                What happens next
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground/85">{nextSteps}</p>
            </div>

            {showBackendDetail ? (
              <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                Detail: {backendDetail}
              </p>
            ) : null}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-8 py-5">
            <p className="text-xs text-muted-foreground">You can close this page safely.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBackToLogin}
            >
              Back to login
            </Button>
          </footer>
        </section>
      </div>
    </main>
  );
};
