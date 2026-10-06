import { useEffect, useState } from 'react';
import {
  getUploadQueueIncludingDownloads,
  getUploadSummary,
  isUploadToastExpanded,
  subscribeUploadQueue,
} from './uploadQueue';
import type { UploadItem, UploadQueueSummary } from './types';

/**
 * Subscribe to the shared transfer queue (uploads + downloads) with upload-shaped items.
 * Prefer `useTransferQueue` for new UI.
 */
export function useUploadQueue(): {
  items: UploadItem[];
  summary: UploadQueueSummary;
  expanded: boolean;
} {
  const [items, setItems] = useState<UploadItem[]>(getUploadQueueIncludingDownloads);
  const [expanded, setExpanded] = useState(isUploadToastExpanded);

  useEffect(() => {
    return subscribeUploadQueue(() => {
      setItems(getUploadQueueIncludingDownloads());
      setExpanded(isUploadToastExpanded());
    });
  }, []);

  return {
    items,
    summary: getUploadSummary(items),
    expanded,
  };
}
