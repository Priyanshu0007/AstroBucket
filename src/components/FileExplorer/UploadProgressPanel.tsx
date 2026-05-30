import React from 'react';
import type { UploadQueueItem } from './types';
import { 
  RefreshCw, 
  AlertCircle, 
  Check, 
  Maximize2, 
  Minimize2, 
  X, 
  Image as ImageIcon, 
  Video, 
  Music, 
  Code, 
  File as FileIcon, 
  FileText 
} from 'lucide-react';

interface UploadProgressPanelProps {
  uploadQueue: UploadQueueItem[];
  showProgressPanel: boolean;
  setShowProgressPanel: (show: boolean) => void;
  isPanelMinimized: boolean;
  setIsPanelMinimized: (minimized: boolean) => void;
  elapsedTime: number;
}

export const UploadProgressPanel: React.FC<UploadProgressPanelProps> = ({
  uploadQueue,
  showProgressPanel,
  setShowProgressPanel,
  isPanelMinimized,
  setIsPanelMinimized,
  elapsedTime
}) => {
  if (!showProgressPanel) return null;

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0 || !bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const totalSize = uploadQueue.reduce((acc, item) => acc + item.size, 0);
  const totalUploadedBytes = uploadQueue.reduce((acc, item) => {
    if (item.status === 'completed') return acc + item.size;
    if (item.status === 'uploading') return acc + (item.size * (item.progress / 100));
    return acc;
  }, 0);
  const overallProgress = totalSize > 0 ? Math.round((totalUploadedBytes / totalSize) * 100) : 0;
  const speed = elapsedTime > 0 ? totalUploadedBytes / elapsedTime : 0;
  
  const formatSpeed = (bytesPerSecond: number) => {
    if (bytesPerSecond === 0) return '—';
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const getETA = () => {
    const remainingBytes = totalSize - totalUploadedBytes;
    if (remainingBytes <= 0) return '0s';
    if (speed <= 0) return 'Calculating...';
    const seconds = Math.ceil(remainingBytes / speed);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remSeconds = seconds % 60;
    return `${minutes}m ${remSeconds}s`;
  };

  const getQueueFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'];
    const videoExts = ['mp4', 'webm', 'ogg', 'mov'];
    const audioExts = ['mp3', 'wav', 'ogg', 'm4a'];
    const codeExts = ['html', 'css', 'js', 'ts', 'jsx', 'tsx', 'json', 'md', 'py', 'java', 'go', 'rs'];
    const sheetExts = ['xlsx', 'xls', 'csv'];
    const docxExts = ['docx'];

    if (imageExts.includes(ext)) return <ImageIcon size={14} style={{ color: '#38bdf8' }} />;
    if (videoExts.includes(ext)) return <Video size={14} style={{ color: '#ec4899' }} />;
    if (audioExts.includes(ext)) return <Music size={14} style={{ color: '#a855f7' }} />;
    if (ext === 'pdf') return <FileText size={14} style={{ color: '#f43f5e' }} />;
    if (sheetExts.includes(ext)) return <FileText size={14} style={{ color: '#10b981' }} />;
    if (docxExts.includes(ext)) return <FileText size={14} style={{ color: '#3b82f6' }} />;
    if (codeExts.includes(ext)) return <Code size={14} style={{ color: '#f59e0b' }} />;
    return <FileIcon size={14} />;
  };

  return (
    <div className={`upload-progress-panel glass-panel ${isPanelMinimized ? 'minimized' : ''}`}>
      <div className="upload-progress-header" onClick={() => setIsPanelMinimized(!isPanelMinimized)}>
        <div className="upload-progress-title">
          {uploadQueue.some(i => i.status === 'uploading') ? (
            <>
              <RefreshCw size={14} className="spin text-primary" />
              <span>Uploading {uploadQueue.filter(i => i.status === 'completed').length + uploadQueue.filter(i => i.status === 'uploading').length}/{uploadQueue.length} files...</span>
            </>
          ) : uploadQueue.some(i => i.status === 'failed') ? (
            <>
              <AlertCircle size={14} className="text-danger" />
              <span>Upload completed with errors</span>
            </>
          ) : (
            <>
              <Check size={14} className="text-success" />
              <span>Upload queue complete</span>
            </>
          )}
        </div>
        <div className="upload-progress-controls" onClick={(e) => e.stopPropagation()}>
          <button 
            className="btn-icon" 
            onClick={() => setIsPanelMinimized(!isPanelMinimized)} 
            title={isPanelMinimized ? "Expand" : "Minimize"}
            style={{ padding: '4px' }}
          >
            {isPanelMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          {!uploadQueue.some(i => i.status === 'uploading') && (
            <button 
              className="btn-icon" 
              onClick={() => setShowProgressPanel(false)} 
              title="Close"
              style={{ padding: '4px' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
      
      {!isPanelMinimized && (
        <div className="upload-progress-body">
          <div className="overall-progress-info">
            <div className="overall-stats-text">
              <span>{formatBytes(totalUploadedBytes)} of {formatBytes(totalSize)}</span>
              <span>{overallProgress}%</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${overallProgress}%` }}></div>
            </div>
            <div className="overall-stats-text" style={{ marginTop: '2px' }}>
              <span>Speed: {formatSpeed(speed)}</span>
              {uploadQueue.some(i => i.status === 'uploading') && <span>ETA: {getETA()}</span>}
            </div>
          </div>
          
          <div className="upload-queue-list">
            {uploadQueue.map((item) => (
              <div className="queue-item" key={item.id}>
                <div className="queue-item-icon-wrapper">
                  {getQueueFileIcon(item.name)}
                </div>
                <div className="queue-item-details">
                  <div className="queue-item-name" title={item.relativePath || item.name}>
                    {item.relativePath || item.name}
                  </div>
                  <div className="queue-item-meta">
                    <span>{formatBytes(item.size)}</span>
                    {item.status === 'uploading' && <span>{item.progress}%</span>}
                    {item.status === 'completed' && <span className="status-badge-completed">Completed</span>}
                    {item.status === 'failed' && <span className="status-badge-failed" title={item.error}>Failed</span>}
                    {item.status === 'pending' && <span>Queued</span>}
                  </div>
                </div>
                
                <div className="queue-item-status-wrapper" title={item.status === 'failed' ? item.error : undefined}>
                  {item.status === 'uploading' && <RefreshCw size={12} className="spin status-badge-uploading" />}
                  {item.status === 'completed' && <Check size={12} className="status-badge-completed" />}
                  {item.status === 'failed' && <AlertCircle size={12} className="status-badge-failed" />}
                </div>
                
                {item.status === 'uploading' && (
                  <div className="queue-item-progress-bar" style={{ width: `${item.progress}%` }}></div>
                )}
                {item.status === 'completed' && (
                  <div className="queue-item-progress-bar completed" style={{ width: '100%' }}></div>
                )}
                {item.status === 'failed' && (
                  <div className="queue-item-progress-bar failed" style={{ width: '100%' }}></div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
