export interface UploadQueueItem {
  id: string;
  name: string;
  relativePath: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
  file: File;
  uploadedBytes?: number;
  startTime?: number;
}

export interface AttachedRepo {
  repo: string;
  branch: string;
}
