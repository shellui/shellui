import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';
import { cn } from '../../lib/utils';
import { formatBytes } from '../storage/quota';
import type { TransferItem } from './types';
import {
  closeTransferToaster,
  getItemPercent,
  interruptAllTransfers,
  interruptTransfer,
  removeTransfer,
  setTransferToastExpanded,
} from './transferQueue';
import { useTransferQueue } from './useTransferQueue';

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('transition-transform duration-200', expanded ? 'rotate-0' : 'rotate-180')}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
      />
      <line
        x1="12"
        x2="12"
        y1="8"
        y2="12"
      />
      <line
        x1="12"
        x2="12.01"
        y1="16"
        y2="16"
      />
    </svg>
  );
}

function CircularProgress({
  percent,
  tone,
}: {
  percent: number;
  tone: 'primary' | 'destructive' | 'muted';
}) {
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const stroke =
    tone === 'destructive'
      ? 'stroke-destructive'
      : tone === 'muted'
        ? 'stroke-muted-foreground'
        : 'stroke-primary';

  return (
    <svg
      className="size-8 -rotate-90"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        className="stroke-muted"
        strokeWidth="2.5"
      />
      <circle
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        className={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 160ms ease-out' }}
      />
    </svg>
  );
}

function StatusGlyph({
  active,
  error,
  percent,
}: {
  active: boolean;
  error: boolean;
  percent: number;
}) {
  if (active) {
    return (
      <CircularProgress
        percent={percent}
        tone="primary"
      />
    );
  }
  if (error) {
    return (
      <div className="flex size-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertIcon />
      </div>
    );
  }
  return (
    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
      <CheckIcon />
    </div>
  );
}

function ProgressTrack({
  percent,
  tone = 'primary',
}: {
  percent: number;
  tone?: 'primary' | 'destructive';
}) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-200 ease-out',
          tone === 'destructive' ? 'bg-destructive' : 'bg-primary',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-transfer-action=""
          aria-label={label}
          className="size-7 shrink-0 text-muted-foreground hover:text-foreground [touch-action:manipulation]"
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        collisionPadding={12}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function FileRow({ item, locale }: { item: TransferItem; locale: string }) {
  const { t } = useTranslation('common');
  const percent = getItemPercent(item);
  const isActive = item.status === 'active';
  const sizeLabel = item.size > 0 ? formatBytes(item.size, locale) : null;
  const completeLabel =
    item.kind === 'download'
      ? t('transfers.statusDownloadComplete')
      : t('transfers.statusUploadComplete');
  const activeLabel =
    item.kind === 'download' ? t('transfers.statusDownloading') : t('transfers.statusUploading');

  return (
    <div className="flex flex-col gap-1.5 py-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-sm font-medium leading-tight',
              item.status === 'cancelled' && 'text-muted-foreground',
            )}
          >
            {item.name}
          </p>
          <p
            className={cn(
              'mt-0.5 text-xs',
              item.status === 'error'
                ? 'break-words text-destructive whitespace-normal'
                : 'text-muted-foreground',
            )}
          >
            {item.status === 'error'
              ? item.error || t('transfers.statusError')
              : isActive
                ? [sizeLabel, t('transfers.progressPercent', { percent })]
                    .filter(Boolean)
                    .join(' · ')
                : item.status === 'success'
                  ? [sizeLabel, completeLabel].filter(Boolean).join(' · ')
                  : t('transfers.statusCancelled')}
          </p>
          {isActive ? <span className="sr-only">{activeLabel}</span> : null}
        </div>
        <IconButton
          label={isActive ? t('transfers.cancelItem') : t('transfers.removeItem')}
          onClick={() => (isActive ? interruptTransfer(item.id) : removeTransfer(item.id))}
        >
          <CloseIcon />
        </IconButton>
      </div>
      {isActive ? <ProgressTrack percent={percent} /> : null}
    </div>
  );
}

export function TransferToastCard() {
  const { t, i18n } = useTranslation('common');
  const { items, summary, expanded } = useTransferQueue();
  const locale = i18n.language || 'en';
  const hasErrors = summary.error > 0;
  const subtitleParts: string[] = [];

  let title: string;
  if (summary.active > 0) {
    if (summary.activeDownloads > 0 && summary.activeUploads === 0) {
      title = t('transfers.titleDownloading', { count: summary.activeDownloads });
    } else if (summary.activeUploads > 0 && summary.activeDownloads === 0) {
      title = t('transfers.titleUploading', { count: summary.activeUploads });
    } else {
      title = t('transfers.titleTransferring', { count: summary.active });
    }
  } else if (summary.error > 0 && summary.success > 0) {
    title = t('transfers.titleMixed', { success: summary.success, errors: summary.error });
  } else if (summary.error > 0) {
    title = t('transfers.titleFailed', { count: summary.error });
  } else if (summary.success > 0) {
    const downloads = items.filter(
      (item) => item.status === 'success' && item.kind === 'download',
    ).length;
    const uploads = items.filter(
      (item) => item.status === 'success' && item.kind === 'upload',
    ).length;
    if (downloads > 0 && uploads === 0) {
      title = t('transfers.titleDownloadComplete', { count: downloads });
    } else if (uploads > 0 && downloads === 0) {
      title = t('transfers.titleUploadComplete', { count: uploads });
    } else {
      title = t('transfers.titleComplete', { count: summary.success });
    }
  } else if (summary.cancelled > 0) {
    title = t('transfers.titleCancelled', { count: summary.cancelled });
  } else {
    title = t('transfers.titleCancelled', { count: summary.total });
  }

  if (summary.active > 0 && summary.bytesTotal > 0) {
    subtitleParts.push(
      t('transfers.bytesProgress', {
        transferred: formatBytes(summary.bytesTransferred, locale),
        total: formatBytes(summary.bytesTotal, locale),
      }),
    );
  }
  if (hasErrors) {
    subtitleParts.push(t('transfers.errorCount', { count: summary.error }));
  }
  if (summary.cancelled > 0) {
    subtitleParts.push(t('transfers.cancelledCount', { count: summary.cancelled }));
  }
  if (summary.active > 0 && summary.total > summary.active) {
    subtitleParts.push(
      t('transfers.itemsProgress', {
        done: summary.success + summary.error,
        total: summary.total,
      }),
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-lg"
        data-transfer-toast=""
        data-upload-toast=""
        role="status"
        aria-live="polite"
        aria-busy={summary.active > 0}
      >
        <div className="flex items-start gap-3 p-3">
          <StatusGlyph
            active={summary.active > 0}
            error={hasErrors && summary.active === 0}
            percent={summary.percent}
          />
          <button
            type="button"
            className="min-w-0 flex-1 cursor-pointer text-left [touch-action:manipulation]"
            aria-expanded={expanded}
            aria-label={expanded ? t('transfers.collapse') : t('transfers.expand')}
            onClick={() => setTransferToastExpanded(!expanded)}
          >
            <p
              className="truncate text-sm font-medium leading-tight"
              style={{ fontFamily: 'var(--heading-font-family, inherit)' }}
            >
              {title}
            </p>
            {subtitleParts.length > 0 ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {subtitleParts.join(' · ')}
              </p>
            ) : null}
          </button>
          <div className="flex items-center">
            <IconButton
              label={expanded ? t('transfers.collapse') : t('transfers.expand')}
              onClick={() => setTransferToastExpanded(!expanded)}
            >
              <ChevronIcon expanded={expanded} />
            </IconButton>
            <IconButton
              label={summary.active > 0 ? t('transfers.closeAndCancel') : t('transfers.dismiss')}
              onClick={() => closeTransferToaster()}
            >
              <CloseIcon />
            </IconButton>
          </div>
        </div>
        <div className="px-3 pb-3">
          <ProgressTrack
            percent={summary.percent}
            tone={hasErrors && summary.active === 0 ? 'destructive' : 'primary'}
          />
        </div>
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-300 ease-out',
            expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div className="border-t border-border px-3">
              <div className="max-h-[min(14rem,calc(var(--shellui-app-height,100dvh)-14rem))] overflow-y-auto overscroll-contain divide-y divide-border">
                {items.map((item) => (
                  <FileRow
                    key={item.id}
                    item={item}
                    locale={locale}
                  />
                ))}
              </div>
              {summary.active > 0 ? (
                <div className="flex justify-end py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-transfer-action=""
                    className="h-8 text-xs text-muted-foreground [touch-action:manipulation]"
                    onClick={() => interruptAllTransfers()}
                  >
                    {t('transfers.cancelAll')}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
