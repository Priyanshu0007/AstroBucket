import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Copy, 
  Maximize2, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  RefreshCw, 
  AlertTriangle,
  FileText,
  Check,
  Sliders
} from 'lucide-react';
import type { GithubFile } from '../lib/github';
import type { GithubSession } from '../App';
import type { AttachedRepo } from './FileExplorer/types';
import { fetchFileRaw, getCdnUrl } from '../lib/github';
import { marked } from 'marked';
import * as XLSX from 'xlsx';
import { renderAsync } from 'docx-preview';
import { ImageEditor } from './ImageEditor';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: GithubFile;
  files: GithubFile[];
  onNavigateToFile: (file: GithubFile) => void;
  session: GithubSession;
  activeRepo: AttachedRepo;
  onFileModified?: () => void;
}

type FileType = 
  | 'image' 
  | 'video' 
  | 'audio' 
  | 'pdf' 
  | 'markdown' 
  | 'code' 
  | 'text' 
  | 'spreadsheet' 
  | 'document' 
  | 'unknown';

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  onClose,
  file,
  files,
  onNavigateToFile,
  session,
  activeRepo,
  onFileModified
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<FileType>('unknown');
  
  // Content states
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string>('');
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null);

  // UI state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [copied, setCopied] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const docxContainerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Filter out directories from the carousel list
  const previewableFiles = files.filter(f => f.type === 'file');
  const currentIndex = previewableFiles.findIndex(f => f.sha === file.sha);

  // Get file type based on extension
  const getFileType = (fileName: string): FileType => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
    const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'm4v'];
    const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];
    const docxExts = ['docx'];
    const xlsExts = ['xlsx', 'xls', 'csv'];
    const codeExts = [
      'js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css', 'py', 'java', 
      'c', 'cpp', 'h', 'go', 'rs', 'php', 'rb', 'sh', 'yml', 'yaml', 
      'xml', 'sql', 'ini', 'toml', 'env'
    ];
    
    if (imageExts.includes(ext)) return 'image';
    if (videoExts.includes(ext)) return 'video';
    if (audioExts.includes(ext)) return 'audio';
    if (ext === 'pdf') return 'pdf';
    if (ext === 'md') return 'markdown';
    if (xlsExts.includes(ext)) return 'spreadsheet';
    if (docxExts.includes(ext)) return 'document';
    if (codeExts.includes(ext)) return 'code';
    if (ext === 'txt') return 'text';
    
    return 'unknown';
  };

  // Memoized navigation handlers to avoid stale closures in keyboard listener
  const handleNext = useCallback(() => {
    if (previewableFiles.length <= 1) return;
    const nextIdx = (currentIndex + 1) % previewableFiles.length;
    onNavigateToFile(previewableFiles[nextIdx]);
  }, [currentIndex, previewableFiles, onNavigateToFile]);

  const handlePrev = useCallback(() => {
    if (previewableFiles.length <= 1) return;
    const prevIdx = (currentIndex - 1 + previewableFiles.length) % previewableFiles.length;
    onNavigateToFile(previewableFiles[prevIdx]);
  }, [currentIndex, previewableFiles, onNavigateToFile]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || isEditing) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isEditing, onClose, handleNext, handlePrev]);

  // Load file content whenever file changes
  useEffect(() => {
    if (!isOpen || !file) return;

    let active = true;
    setLoading(true);
    setError(null);
    setZoomLevel(1);
    setIsEditing(false);
    
    // Revoke previous URL to prevent memory leak
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      setObjectUrl(null);
    }
    
    setTextContent('');
    setSheetData([]);
    setSheetNames([]);
    setActiveSheetIdx(0);
    setDocxBlob(null);

    const type = getFileType(file.name);
    setFileType(type);

    const loadContent = async () => {
      try {
        const creds = {
          token: session.token,
          owner: session.owner,
          repo: activeRepo.repo,
          branch: activeRepo.branch
        };

        const blob = await fetchFileRaw(creds, file.path);
        
        if (!active) return;

        if (type === 'image' || type === 'video' || type === 'audio' || type === 'pdf') {
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          const mimeMap: Record<string, string> = {
            png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
            gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
            ico: 'image/x-icon', bmp: 'image/bmp',
            mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg', mov: 'video/quicktime',
            mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac',
            pdf: 'application/pdf',
          };
          const correctMime = mimeMap[ext];
          const typedBlob = correctMime && blob.type !== correctMime
            ? new Blob([blob], { type: correctMime })
            : blob;
          const url = URL.createObjectURL(typedBlob);
          setObjectUrl(url);
        } else if (type === 'text' || type === 'code' || type === 'markdown') {
          const text = await blob.text();
          setTextContent(text);
        } else if (type === 'spreadsheet') {
          const arrayBuffer = await blob.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          setSheetNames(workbook.SheetNames);
          
          if (workbook.SheetNames.length > 0) {
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
            setSheetData(data);
          }
        } else if (type === 'document') {
          setDocxBlob(blob);
        }

        setLoading(false);
      } catch (err: any) {
        console.error('Error previewing file:', err);
        if (active) {
          setError(err.message || 'Could not load file preview');
          setLoading(false);
        }
      }
    };

    loadContent();

    return () => {
      active = false;
    };
  }, [file, isOpen]);

  // Handle Sheet Tab Change
  const handleSheetChange = async (index: number) => {
    setActiveSheetIdx(index);
    setLoading(true);
    try {
      const creds = {
        token: session.token,
        owner: session.owner,
        repo: activeRepo.repo,
        branch: activeRepo.branch
      };
      const blob = await fetchFileRaw(creds, file.path);
      const arrayBuffer = await blob.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[index];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      setSheetData(data);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError('Could not switch sheets');
      setLoading(false);
    }
  };

  // Render Docx
  useEffect(() => {
    if (fileType === 'document' && docxBlob && docxContainerRef.current) {
      docxContainerRef.current.innerHTML = '';
      renderAsync(docxBlob, docxContainerRef.current, undefined, {
        className: 'docx-preview-output',
        inWrapper: false
      }).catch(err => {
        console.error('Docx rendering error:', err);
        if (docxContainerRef.current) {
          docxContainerRef.current.innerHTML = `<div class="p-6 text-center text-red-500">Failed to render document visual preview.</div>`;
        }
      });
    }
  }, [docxBlob, fileType, loading]);

  // Clean up Object URL on unmount
  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  if (!isOpen) return null;

  const handleCopyCdn = () => {
    const url = getCdnUrl(session.owner, activeRepo.repo, activeRepo.branch, file.path);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    try {
      const creds = {
        token: session.token,
        owner: session.owner,
        repo: activeRepo.repo,
        branch: activeRepo.branch
      };
      const blob = await fetchFileRaw(creds, file.path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to download file');
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      modalRef.current?.requestFullscreen?.().catch(err => {
        console.error('Could not enter fullscreen:', err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(err => {
        console.error('Could not exit fullscreen:', err);
      });
      setIsFullscreen(false);
    }
  };

  // Sync fullscreen state with ESC/hardware key releases
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const renderContent = () => {
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
          <div className="preview-audio-container">
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
        return (
          <div className="preview-markdown-container markdown-body">
            <div 
              dangerouslySetInnerHTML={{ __html: marked.parse(textContent, { async: false }) }} 
            />
          </div>
        );

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
          <div className="preview-spreadsheet-container">
            {sheetNames.length > 1 && (
              <div className="spreadsheet-tabs">
                {sheetNames.map((name, idx) => (
                  <button 
                    key={idx}
                    className={`sheet-tab ${activeSheetIdx === idx ? 'active' : ''}`}
                    onClick={() => handleSheetChange(idx)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
            <div className="spreadsheet-table-wrapper">
              <table className="excel-table">
                <tbody>
                  {sheetData.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      <td className="row-number-cell">{rowIdx + 1}</td>
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className="excel-cell">
                          {cell !== undefined && cell !== null ? String(cell) : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {sheetData.length === 0 && (
                    <tr>
                      <td style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        This sheet is empty.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'document':
        return (
          <div className="preview-docx-container">
            <div ref={docxContainerRef} className="docx-render-target" />
          </div>
        );

      default:
        return (
          <div className="preview-fallback-container">
            <FileText size={80} className="text-muted" style={{ marginBottom: '1.5rem', opacity: 0.5 }} />
            <h3>No Preview Available</h3>
            <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
              Preview for {(file.name.split('.').pop() || 'unknown').toUpperCase()} files is not supported.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-primary" onClick={handleDownload}>
                <Download size={16} /> Download to View
              </button>
              <button className="btn btn-outline" onClick={handleCopyCdn}>
                {copied ? <Check size={16} style={{ color: '#10b981' }} /> : <Copy size={16} />} 
                {copied ? 'Copied!' : 'Copy CDN Link'}
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`preview-modal-overlay ${isFullscreen ? 'fullscreen' : ''}`} ref={modalRef}>
      {/* Modal Toolbar */}
      <header className="preview-toolbar">
        <div className="preview-toolbar-left">
          {isEditing ? (
            <Sliders size={18} className="text-primary" />
          ) : (
            <FileText size={18} className="text-primary" />
          )}
          <span className="preview-filename" title={file.path}>
            {isEditing ? `Editing ${file.name}` : file.name}
          </span>
          {isEditing && (
            <span className="editor-badge">
              Image Editor
            </span>
          )}
        </div>
        
        <div className="preview-toolbar-center">
          {!isEditing && fileType === 'image' && (
            <div className="zoom-controls">
              <button className="toolbar-btn" onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))} title="Zoom Out">
                <ZoomOut size={16} />
              </button>
              <span className="zoom-text">{Math.round(zoomLevel * 100)}%</span>
              <button className="toolbar-btn" onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))} title="Zoom In">
                <ZoomIn size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="preview-toolbar-right">
          {!isEditing && fileType === 'image' && (
            <button className="toolbar-btn" onClick={() => setIsEditing(true)} title="Edit & Compress Image">
              <Sliders size={16} />
            </button>
          )}
          {!isEditing && (
            <>
              <button className="toolbar-btn" onClick={handleCopyCdn} title="Copy CDN Link">
                {copied ? <Check size={16} style={{ color: '#10b981' }} /> : <Copy size={16} />}
              </button>
              <button className="toolbar-btn" onClick={handleDownload} title="Download File">
                <Download size={16} />
              </button>
              <button className="toolbar-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <div className="toolbar-divider" />
            </>
          )}
          {isEditing && (
            <button 
              className="btn btn-outline" 
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', marginRight: '0.5rem' }} 
              onClick={() => setIsEditing(false)}
            >
              Exit Editor
            </button>
          )}
          <button className="toolbar-btn close-btn" onClick={onClose} title="Close Preview">
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {isEditing && objectUrl ? (
        <ImageEditor 
          file={file}
          session={session}
          activeRepo={activeRepo}
          objectUrl={objectUrl}
          files={files}
          onExitEditor={() => setIsEditing(false)}
          onClose={onClose}
          onFileModified={onFileModified}
        />
      ) : (
        /* Normal Preview Area with Carousel Navigation */
        <div className="preview-body-container">
          {previewableFiles.length > 1 && (
            <button className="carousel-nav-btn prev" onClick={handlePrev} title="Previous File (Left Arrow)">
              <ChevronLeft size={24} />
            </button>
          )}

          <div className="preview-content-box">
            {renderContent()}
          </div>

          {previewableFiles.length > 1 && (
            <button className="carousel-nav-btn next" onClick={handleNext} title="Next File (Right Arrow)">
              <ChevronRight size={24} />
            </button>
          )}
        </div>
      )}

      {/* Carousel Footer info */}
      {!isEditing && previewableFiles.length > 1 && (
        <footer className="preview-footer">
          <span>{currentIndex + 1} of {previewableFiles.length} files</span>
        </footer>
      )}
    </div>
  );
};
