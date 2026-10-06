import { useEffect, useState } from 'react';
import {
  getTransferQueue,
  getTransferSummary,
  isTransferToastExpanded,
  subscribeTransferQueue,
} from './transferQueue';
import type { TransferItem, TransferQueueSummary } from './types';

export function useTransferQueue(): {
  items: TransferItem[];
  summary: TransferQueueSummary;
  expanded: boolean;
} {
  const [items, setItems] = useState<TransferItem[]>(getTransferQueue);
  const [expanded, setExpanded] = useState(isTransferToastExpanded);

  useEffect(() => {
    return subscribeTransferQueue(() => {
      setItems(getTransferQueue());
      setExpanded(isTransferToastExpanded());
    });
  }, []);

  return {
    items,
    summary: getTransferSummary(items),
    expanded,
  };
}
