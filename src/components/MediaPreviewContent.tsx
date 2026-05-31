import React from 'react';
import { RefreshCw, AlertTriangle, FileText, Download } from 'lucide-react';
import type { GithubFile } from '../api/types';
import { MarkdownPreview } from './MarkdownPreview';
import { SpreadsheetPreview } from './SpreadsheetPreview';
import { DocxPreview } from './DocxPreview';
import { FallbackPreview } from './FallbackPreview';

interface MediaPreviewContentProps {
  loading: boolean;
  error: string | null;
  fileType: string;
  file: GithubFile;
  objectUrl: string | null;
  zoomLevel: number;
  textContent: string;
  sheetNames: string[];
  sheetData: any[][];
  activeSheetIdx: number;
  handleSheetChange: (idx: number) => void;
  docxBlob: Blob | null;
  copied: boolean;
  handleDownload: () => void;
  handleCopyCdn: () => void;
}

export const MediaPreviewContent: React.FC<MediaPreviewContentProps> = ({
  loading,
  error,
  fileType,
  file,
  objectUrl,
  zoomLevel,
  textContent,
  sheetNames,
  sheetData,
  activeSheetIdx,
  handleSheetChange,
  docxBlob,
  copied,
  handleDownload,
  handleCopyCdn
}) => {
  if (loading) {
    return (
      <div className="preview-loading">
        <RefreshCw size={40} className="spin text-primary" />
        <span>Fetching file stream...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="preview-error">
        <AlertTriangle size={48} className="text-danger" />
        <h3>Unable to Load Preview</h3>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={handleDownload}>
          <Download size={16} /> Download File Instead
        </button>
      </div>
    );
  }

  switch (fileType) {
    case 'image':
      return (
        <div className="preview-image-container" style={{ overflow: 'auto' }}>
          <img 
            src={objectUrl || undefined} 
            alt={file.name} 
            className="preview-image" 
            style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.15s ease' }}
          />
        </div>
      );

    case 'video':
      return (
        <div className="preview-video-container">
          <video 
            src={objectUrl || undefined} 
            controls 
            autoPlay
            className="preview-video"
          />
        </div>
      );

    case 'audio':
      return (
        <div className="preview-video-container">
          <div className="audio-card glass-panel">
            <FileText size={48} className="text-primary" style={{ marginBottom: '1rem' }} />
            <h4 style={{ marginBottom: '1rem' }}>{file.name}</h4>
            <audio 
              src={objectUrl || undefined} 
              controls 
              autoPlay
              style={{ width: '100%' }}
            />
          </div>
        </div>
      );

    case 'pdf':
      return (
        <div className="preview-pdf-container">
          <object 
            data={objectUrl || undefined} 
            type="application/pdf" 
            width="100%" 
            height="100%"
          >
            <iframe 
              src={objectUrl || undefined} 
              width="100%" 
              height="100%" 
              title={file.name}
            />
          </object>
        </div>
      );

    case 'markdown':
      return <MarkdownPreview textContent={textContent} />;

    case 'code':
    case 'text':
      return (
        <div className="preview-code-container">
          <pre className="code-block">
            <code>{textContent}</code>
          </pre>
        </div>
      );

    case 'spreadsheet':
      return (
        <SpreadsheetPreview 
          sheetNames={sheetNames}
          sheetData={sheetData}
          activeSheetIdx={activeSheetIdx}
          onSheetChange={handleSheetChange}
        />
      );

    case 'document':
      return <DocxPreview docxBlob={docxBlob} loading={loading} />;

    default:
      return (
        <FallbackPreview 
          file={file}
          copied={copied}
          onDownload={handleDownload}
          onCopyCdn={handleCopyCdn}
        />
      );
  }
};
