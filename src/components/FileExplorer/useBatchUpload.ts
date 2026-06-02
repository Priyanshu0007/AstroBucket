import { useState, useEffect } from 'react';
import type { GithubSession } from '../../App';
import type { AttachedRepo, UploadQueueItem } from './types';
import { fetchRepoTree, uploadFile, fileToBase64 } from '../../api/client';

interface UseBatchUploadProps {
  session: GithubSession;
  activeRepo: AttachedRepo | null;
  currentPath: string;
  refetchContents: () => void;
  refetchRepoTree: () => void;
}

export function useBatchUpload({
  session,
  activeRepo,
  currentPath,
  refetchContents,
  refetchRepoTree
}: UseBatchUploadProps) {
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [showProgressPanel, setShowProgressPanel] = useState<boolean>(false);
  const [isPanelMinimized, setIsPanelMinimized] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [uploading, setUploading] = useState<boolean>(false);

  // Elapsed time tracker for speed calculations
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined = undefined;
    const isUploading = uploadQueue.some(item => item.status === 'uploading');
    if (isUploading) {
      timer = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [uploadQueue]);

  const startBatchUpload = async (filesToUpload: { file: File; relativePath: string }[]) => {
    if (!activeRepo) return;
    
    setElapsedTime(0);
    setUploading(true);
    setShowProgressPanel(true);
    setIsPanelMinimized(false);

    const newItems: UploadQueueItem[] = filesToUpload.map(item => ({
      id: Math.random().toString(36).substring(2, 9),
      name: item.file.name,
      relativePath: item.relativePath,
      size: item.file.size,
      progress: 0,
      status: 'pending',
      file: item.file
    }));
    
    setUploadQueue(newItems);
    
    const creds = {
      token: session.token,
      owner: session.owner,
      repo: activeRepo.repo,
      branch: activeRepo.branch
    };
    
    let shaMap: Record<string, string> = {};
    try {
      const tree = await fetchRepoTree(creds);
      tree.forEach(node => {
        if (node.type === 'blob') {
          shaMap[node.path] = node.sha;
        }
      });
    } catch (err) {
      console.error('Error fetching tree, proceeding without SHA map:', err);
    }

    const updateItemStatus = (id: string, updates: Partial<UploadQueueItem>) => {
      setUploadQueue(prev => prev.map(item => {
        if (item.id === id) {
          return { ...item, ...updates };
        }
        return item;
      }));
    };

    const maxConcurrency = 3;
    let activeIndex = 0;

    const uploadSingleFile = async (item: UploadQueueItem) => {
      const finalPath = currentPath 
        ? `${currentPath}/${item.relativePath}` 
        : item.relativePath;
        
      updateItemStatus(item.id, { status: 'uploading', startTime: Date.now() });
      
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.min(5, (90 - progress) / 5);
        updateItemStatus(item.id, { progress: Math.floor(progress) });
      }, 150);

      try {
        const base64 = await fileToBase64(item.file);
        const sha = shaMap[finalPath];
        
        await uploadFile(creds, finalPath, base64, `Upload ${item.name}`, sha);
        
        clearInterval(progressInterval);
        updateItemStatus(item.id, { 
          status: 'completed', 
          progress: 100, 
          uploadedBytes: item.size 
        });
      } catch (err) {
        clearInterval(progressInterval);
        console.error(`Failed to upload ${item.name}:`, err);
        updateItemStatus(item.id, { 
          status: 'failed', 
          progress: 0, 
          error: err instanceof Error ? err.message : 'Upload failed' 
        });
      }
    };

    const worker = async () => {
      while (activeIndex < newItems.length) {
        const index = activeIndex++;
        if (index >= newItems.length) break;
        await uploadSingleFile(newItems[index]);
      }
    };

    const workers = [];
    for (let i = 0; i < Math.min(maxConcurrency, newItems.length); i++) {
      workers.push(worker());
    }
    
    await Promise.all(workers);
    
    setUploading(false);
    refetchContents();
    refetchRepoTree();
  };

  return {
    uploadQueue,
    showProgressPanel,
    setShowProgressPanel,
    isPanelMinimized,
    setIsPanelMinimized,
    elapsedTime,
    uploading,
    startBatchUpload
  };
}
