export type UploadItemStatus = 'uploading' | 'success' | 'error' | 'cancelled';

export type UploadItem = {
  id: string;
  name: string;
  path: string;
  bucket: string;
  size: number;
  bytesUploaded: number;
  status: UploadItemStatus;
  error?: string;
  demo?: boolean;
};

export type UploadQueueSummary = {
  total: number;
  uploading: number;
  success: number;
  error: number;
  cancelled: number;
  bytesUploaded: number;
  bytesTotal: number;
  percent: number;
};
