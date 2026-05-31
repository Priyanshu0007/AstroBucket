import React from 'react';
import { FileText, Download, Copy, Check } from 'lucide-react';
import type { GithubFile } from '../api/types';

interface FallbackPreviewProps {
  file: GithubFile;
  copied: boolean;
  onDownload: () => void;
  onCopyCdn: () => void;
}

export const FallbackPreview: React.FC<FallbackPreviewProps> = ({
  file,
  copied,
  onDownload,
  onCopyCdn
}) => {
  return (
    <div className="preview-fallback-container">
      <FileText size={80} className="text-muted" style={{ marginBottom: '1.5rem', opacity: 0.5 }} />
      <h3>No Preview Available</h3>
      <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
        Preview for {(file.name.split('.').pop() || 'unknown').toUpperCase()} files is not supported.
      </p>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button className="btn btn-primary" onClick={onDownload}>
          <Download size={16} /> Download to View
        </button>
        <button className="btn btn-outline" onClick={onCopyCdn}>
          {copied ? <Check size={16} style={{ color: '#10b981' }} /> : <Copy size={16} />} 
          {copied ? 'Copied!' : 'Copy CDN Link'}
        </button>
      </div>
    </div>
  );
};
