import React, { useState, useEffect, useCallback } from 'react';
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
  FileText,
  Check,
  Sliders
} from 'lucide-react';
import type { GithubFile } from '../api/types';
import type { GithubSession } from '../App';
import type { AttachedRepo } from './FileExplorer/types';
import { fetchFileRaw, getCdnUrl } from '../api/client';
import * as XLSX from 'xlsx';
import { ImageEditor } from './ImageEditor';
import { MediaPreviewContent } from './MediaPreviewContent';

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
  const [sheetData, setSheetData] = useState<(string | number | boolean | null | undefined)[][]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null);

  // UI state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [copied, setCopied] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const modalRef = React.useRef<HTMLDivElement>(null);

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
            const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as (string | number | boolean | null | undefined)[][];
            setSheetData(data);
          }
        } else if (type === 'document') {
          setDocxBlob(blob);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error previewing file:', err);
        if (active) {
          setError(err instanceof Error ? err.message : 'Could not load file preview');
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
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as (string | number | boolean | null | undefined)[][];
      setSheetData(data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Could not switch sheets');
      setLoading(false);
    }
  };

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
            <MediaPreviewContent
              loading={loading}
              error={error}
              fileType={fileType}
              file={file}
              objectUrl={objectUrl}
              zoomLevel={zoomLevel}
              textContent={textContent}
              sheetNames={sheetNames}
              sheetData={sheetData}
              activeSheetIdx={activeSheetIdx}
              handleSheetChange={handleSheetChange}
              docxBlob={docxBlob}
              copied={copied}
              handleDownload={handleDownload}
              handleCopyCdn={handleCopyCdn}
            />
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
