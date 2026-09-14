import { useEffect, useState } from 'react';
import { shellui } from '@shellui/sdk';
import { Button } from '../../components/ui/button';

type DemoVariant = 'default' | 'updated';

function applyDemoActions(variant: DemoVariant): void {
  const updated = variant === 'updated';
  shellui.actions.set({
    variant: updated ? 'secondary' : 'outline',
    back: {
      id: 'demo-back',
      onClick: () => {
        shellui.toast({ title: 'Back clicked (iframe)', type: 'info' });
      },
    },
    title: updated ? 'Inbox · updated' : 'Inbox',
    trailing: [
      {
        id: 'demo-edit',
        label: updated ? 'Rename' : 'Edit',
        icon: 'edit',
        onClick: () => shellui.toast({ title: 'Edit clicked (iframe)', type: 'default' }),
      },
      {
        id: 'demo-share',
        label: 'Share',
        icon: 'share',
        onClick: () => shellui.toast({ title: 'Share clicked (iframe)', type: 'default' }),
      },
      {
        id: 'demo-filter',
        label: 'Filter',
        icon: 'filter',
        onClick: () => shellui.toast({ title: 'Filter clicked (iframe)', type: 'default' }),
      },
      {
        id: 'demo-archive',
        label: 'Archive',
        icon: 'archive',
        variant: updated ? 'destructive' : undefined,
        onClick: () => shellui.toast({ title: 'Archive clicked (iframe)', type: 'default' }),
      },
    ],
    primary: {
      id: 'demo-compose',
      icon: 'plus',
      label: 'Compose',
      onClick: () => shellui.toast({ title: 'Primary FAB clicked (iframe)', type: 'success' }),
    },
  });
}

/**
 * Shell-owned page loaded inside a modal/drawer iframe from Settings → Develop.
 * Exercises `shellui.actions.set/clear` through the real iframe postMessage path.
 */
export function ChromeActionsDemoView() {
  const [variant, setVariant] = useState<DemoVariant>('default');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void shellui.init().then(() => {
      if (cancelled) return;
      applyDemoActions('default');
      setReady(true);
    });
    return () => {
      cancelled = true;
      shellui.actions.clear();
    };
  }, []);

  return (
    <div
      data-chrome-actions-demo-root
      className="box-border min-h-full bg-background text-foreground px-5"
    >
      <h1
        className="text-base font-semibold mb-1 pt-4"
        style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
      >
        Chrome actions (iframe)
      </h1>
      <p className="text-sm text-muted-foreground mb-4">
        This page runs inside an iframe and drives floating chrome via{' '}
        <code className="text-xs">shellui.actions.set()</code> /{' '}
        <code className="text-xs">clear()</code>. Clicks round-trip with{' '}
        <code className="text-xs">SHELLUI_ACTION</code>. Top/bottom padding comes from{' '}
        <code className="text-xs">--shellui-inset-*</code> (animated when actions set or clear).
      </p>

      {!ready ? (
        <p className="text-sm text-muted-foreground">Initializing SDK…</p>
      ) : (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setVariant('default');
              applyDemoActions('default');
            }}
          >
            Set actions
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setVariant('updated');
              applyDemoActions('updated');
            }}
          >
            Update actions
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => shellui.actions.clear()}
          >
            Clear actions
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              shellui.actions.clear();
              shellui.closeDrawer();
              shellui.closeModal();
            }}
          >
            Close
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Current variant: <strong className="text-foreground">{variant}</strong>. Narrow the viewport
        (or open as a drawer on mobile) to see trailing actions collapse into ···.
      </p>
    </div>
  );
}
