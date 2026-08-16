import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../components/ui/tooltip';
import { cn } from '../../../lib/utils';
import { formatBytes } from '../quota';
import type { UploadItem } from './types';
import {
  closeUploadToaster,
  getItemPercent,
  interruptAllUploads,
  interruptUpload,
  removeUpload,
  setUploadToastExpanded,
} from './uploadQueue';
import { useUploadQueue } from './useUploadQueue';

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
  uploading,
  error,
  percent,
}: {
  uploading: boolean;
  error: boolean;
  percent: number;
}) {
  if (uploading) {
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
          data-upload-action=""
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

function titleForSummary(
  t: (key: string, options?: Record<string, unknown>) => string,
  summary: ReturnType<typeof useUploadQueue>['summary'],
): string {
  if (summary.uploading > 0) {
    return t('uploads.titleUploading', { count: summary.uploading });
  }
  if (summary.error > 0 && summary.success > 0) {
    return t('uploads.titleMixed', { success: summary.success, errors: summary.error });
  }
  if (summary.error > 0) {
    return t('uploads.titleFailed', { count: summary.error });
  }
  if (summary.success > 0) {
    return t('uploads.titleComplete', { count: summary.success });
  }
  if (summary.cancelled > 0) {
    return t('uploads.titleCancelled', { count: summary.cancelled });
  }
  return t('uploads.titleCancelled', { count: summary.total });
}

function FileRow({ item, locale }: { item: UploadItem; locale: string }) {
  const { t } = useTranslation('common');
  const percent = getItemPercent(item);
  const isUploading = item.status === 'uploading';
  const sizeLabel = item.size > 0 ? formatBytes(item.size, locale) : null;

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
              item.status === 'error' ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {item.status === 'error'
              ? item.error || t('uploads.statusError')
              : isUploading
                ? [sizeLabel, t('uploads.progressPercent', { percent })].filter(Boolean).join(' · ')
                : item.status === 'success'
                  ? [sizeLabel, t('uploads.statusComplete')].filter(Boolean).join(' · ')
                  : t('uploads.statusCancelled')}
          </p>
        </div>
        <IconButton
          label={isUploading ? t('uploads.cancelFile') : t('uploads.removeFile')}
          onClick={() => (isUploading ? interruptUpload(item.id) : removeUpload(item.id))}
        >
          <CloseIcon />
        </IconButton>
      </div>
      {isUploading ? <ProgressTrack percent={percent} /> : null}
    </div>
  );
}

export function UploadToastCard() {
  const { t, i18n } = useTranslation('common');
  const { items, summary, expanded } = useUploadQueue();
  const locale = i18n.language || 'en';
  const title = titleForSummary(t, summary);
  const hasErrors = summary.error > 0;
  const subtitleParts: string[] = [];

  if (summary.uploading > 0 && summary.bytesTotal > 0) {
    subtitleParts.push(
      t('uploads.bytesProgress', {
        uploaded: formatBytes(summary.bytesUploaded, locale),
        total: formatBytes(summary.bytesTotal, locale),
      }),
    );
  }
  if (hasErrors) {
    subtitleParts.push(t('uploads.errorCount', { count: summary.error }));
  }
  if (summary.cancelled > 0) {
    subtitleParts.push(t('uploads.cancelledCount', { count: summary.cancelled }));
  }
  if (summary.uploading > 0 && summary.total > summary.uploading) {
    subtitleParts.push(
      t('uploads.filesProgress', { done: summary.success + summary.error, total: summary.total }),
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-lg"
        data-upload-toast=""
        role="status"
        aria-live="polite"
        aria-busy={summary.uploading > 0}
      >
        <div className="flex items-start gap-3 p-3">
          <StatusGlyph
            uploading={summary.uploading > 0}
            error={hasErrors && summary.uploading === 0}
            percent={summary.percent}
          />
          <button
            type="button"
            className="min-w-0 flex-1 cursor-pointer text-left [touch-action:manipulation]"
            aria-expanded={expanded}
            aria-label={expanded ? t('uploads.collapse') : t('uploads.expand')}
            onClick={() => setUploadToastExpanded(!expanded)}
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
              label={expanded ? t('uploads.collapse') : t('uploads.expand')}
              onClick={() => setUploadToastExpanded(!expanded)}
            >
              <ChevronIcon expanded={expanded} />
            </IconButton>
            <IconButton
              label={summary.uploading > 0 ? t('uploads.closeAndCancel') : t('uploads.dismiss')}
              onClick={() => closeUploadToaster()}
            >
              <CloseIcon />
            </IconButton>
          </div>
        </div>
        <div className="px-3 pb-3">
          <ProgressTrack
            percent={summary.percent}
            tone={hasErrors && summary.uploading === 0 ? 'destructive' : 'primary'}
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
              <div className="max-h-[min(14rem,calc(100dvh-14rem))] overflow-y-auto overscroll-contain divide-y divide-border">
                {items.map((item) => (
                  <FileRow
                    key={item.id}
                    item={item}
                    locale={locale}
                  />
                ))}
              </div>
              {summary.uploading > 0 ? (
                <div className="flex justify-end py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    data-upload-action=""
                    className="h-8 text-xs text-muted-foreground [touch-action:manipulation]"
                    onClick={() => interruptAllUploads()}
                  >
                    {t('uploads.cancelAll')}
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
