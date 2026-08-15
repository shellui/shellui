import { useEffect, useState } from 'react';
import {
  getUploadQueue,
  getUploadSummary,
  isUploadToastExpanded,
  subscribeUploadQueue,
} from './uploadQueue';
import type { UploadItem, UploadQueueSummary } from './types';

export function useUploadQueue(): {
  items: UploadItem[];
  summary: UploadQueueSummary;
  expanded: boolean;
} {
  const [items, setItems] = useState<UploadItem[]>(getUploadQueue);
  const [expanded, setExpanded] = useState(isUploadToastExpanded);

  useEffect(() => {
    return subscribeUploadQueue(() => {
      setItems(getUploadQueue());
      setExpanded(isUploadToastExpanded());
    });
  }, []);

  return {
    items,
    summary: getUploadSummary(items),
    expanded,
  };
}
