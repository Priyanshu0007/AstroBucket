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
  Sliders,
  Crop,
  RotateCw,
  RotateCcw,
  Lock,
  Unlock,
  Save,
  FlipHorizontal,
  FlipVertical
} from 'lucide-react';
import type { GithubFile } from '../lib/github';
import type { GithubSession } from '../App';
import type { AttachedRepo } from './FileExplorer';
import { fetchFileRaw, getCdnUrl, uploadFile, deleteFile } from '../lib/github';
import { marked } from 'marked';
import * as XLSX from 'xlsx';
import { renderAsync } from 'docx-preview';

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

  const docxContainerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Image Editor States
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [rotate, setRotate] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [cropMode, setCropMode] = useState<boolean>(false);
  const [cropBox, setCropBox] = useState({ left: 10, top: 10, width: 80, height: 80 });
  const [cropAspectRatio, setCropAspectRatio] = useState<number | null>(null);
  const [targetWidth, setTargetWidth] = useState<number>(0);
  const [targetHeight, setTargetHeight] = useState<number>(0);
  const [aspectRatioLocked, setAspectRatioLocked] = useState<boolean>(true);
  const [compressionFormat, setCompressionFormat] = useState<string>('image/webp');
  const [compressionQuality, setCompressionQuality] = useState<number>(0.8);
  const [commitMessage, setCommitMessage] = useState<string>('');
  const [targetPath, setTargetPath] = useState<string>('');
  const [deleteOriginalOnFormatChange, setDeleteOriginalOnFormatChange] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialCropBox, setInitialCropBox] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const [dragType, setDragType] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | null>(null);

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
          // Re-wrap blob with correct MIME type — GitHub's raw API often returns
          // application/octet-stream which prevents browsers from decoding WebP/etc.
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

  // Reset editor states when file changes or modal closes
  useEffect(() => {
    setIsEditing(false);
    setRotate(0);
    setFlipH(false);
    setFlipV(false);
    setCropMode(false);
    setOriginalImage(null);
    setEstimatedSize(null);
    setSavingError(null);
  }, [file, isOpen]);

  // Load Image element for Canvas editing
  useEffect(() => {
    if (isEditing && objectUrl) {
      setImageError(null); // Clear any previous error
      const img = new Image();
      img.onload = () => {
        setOriginalImage(img);
        setTargetWidth(img.naturalWidth);
        setTargetHeight(img.naturalHeight);
        setTargetPath(changeExtension(file.path, compressionFormat));
        setCommitMessage(`Optimize & edit image: ${file.name}`);
        setRotate(0);
        setFlipH(false);
        setFlipV(false);
        setCropMode(false);
        setCropBox({ left: 10, top: 10, width: 80, height: 80 });
        setCropAspectRatio(null);
        setAspectRatioLocked(true);
      };
      img.onerror = () => {
        setImageError(`Failed to parse "${file.name}" for editing. The file may be corrupted.`);
      };
      img.src = objectUrl;
    } else {
      setOriginalImage(null);
    }
  }, [isEditing, objectUrl]);

  // Calculate Display Size for workspace image element
  const updateDisplaySize = () => {
    if (!originalImage || !workspaceRef.current) return;
    
    const maxW = workspaceRef.current.clientWidth - 48;
    const maxH = workspaceRef.current.clientHeight - 48;
    
    const isRotated90 = rotate === 90 || rotate === 270;
    const imgW = isRotated90 ? originalImage.naturalHeight : originalImage.naturalWidth;
    const imgH = isRotated90 ? originalImage.naturalWidth : originalImage.naturalHeight;
    
    const scale = Math.min(maxW / imgW, maxH / imgH, 1);
    
    setDisplaySize({
      width: Math.round(imgW * scale),
      height: Math.round(imgH * scale)
    });
  };

  useEffect(() => {
    if (originalImage) {
      updateDisplaySize();
      window.addEventListener('resize', updateDisplaySize);
      return () => window.removeEventListener('resize', updateDisplaySize);
    }
  }, [originalImage, rotate, flipH, flipV]);

  // Redraw Workspace Canvas
  useEffect(() => {
    if (!originalImage || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const isRotated90 = rotate === 90 || rotate === 270;
    
    if (cropMode) {
      const canvasW = isRotated90 ? originalImage.naturalHeight : originalImage.naturalWidth;
      const canvasH = isRotated90 ? originalImage.naturalWidth : originalImage.naturalHeight;
      
      canvas.width = canvasW;
      canvas.height = canvasH;
      
      ctx.clearRect(0, 0, canvasW, canvasH);
      
      ctx.translate(canvasW / 2, canvasH / 2);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.rotate((rotate * Math.PI) / 180);
      ctx.drawImage(
        originalImage, 
        -originalImage.naturalWidth / 2, 
        -originalImage.naturalHeight / 2
      );
    } else {
      // 1. Draw transformed to intermediate canvas
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      
      const rotW = isRotated90 ? originalImage.naturalHeight : originalImage.naturalWidth;
      const rotH = isRotated90 ? originalImage.naturalWidth : originalImage.naturalHeight;
      tempCanvas.width = rotW;
      tempCanvas.height = rotH;
      
      tempCtx.translate(rotW / 2, rotH / 2);
      tempCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      tempCtx.rotate((rotate * Math.PI) / 180);
      tempCtx.drawImage(
        originalImage,
        -originalImage.naturalWidth / 2,
        -originalImage.naturalHeight / 2
      );
      
      // 2. Crop rect bounds
      const sX = (cropBox.left / 100) * rotW;
      const sY = (cropBox.top / 100) * rotH;
      const sW = (cropBox.width / 100) * rotW;
      const sH = (cropBox.height / 100) * rotH;
      
      canvas.width = targetWidth || 1;
      canvas.height = targetHeight || 1;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(
        tempCanvas,
        sX, sY, sW, sH,
        0, 0, canvas.width, canvas.height
      );
    }
  }, [originalImage, rotate, flipH, flipV, cropMode, cropBox, targetWidth, targetHeight]);

  // Debounced estimation of compressed file size
  useEffect(() => {
    if (!originalImage) return;
    
    const timer = setTimeout(() => {
      const isRotated90 = rotate === 90 || rotate === 270;
      
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      
      const rotW = isRotated90 ? originalImage.naturalHeight : originalImage.naturalWidth;
      const rotH = isRotated90 ? originalImage.naturalWidth : originalImage.naturalHeight;
      tempCanvas.width = rotW;
      tempCanvas.height = rotH;
      
      tempCtx.translate(rotW / 2, rotH / 2);
      tempCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      tempCtx.rotate((rotate * Math.PI) / 180);
      tempCtx.drawImage(
        originalImage,
        -originalImage.naturalWidth / 2,
        -originalImage.naturalHeight / 2
      );
      
      const sX = (cropBox.left / 100) * rotW;
      const sY = (cropBox.top / 100) * rotH;
      const sW = (cropBox.width / 100) * rotW;
      const sH = (cropBox.height / 100) * rotH;
      
      const finalCanvas = document.createElement('canvas');
      const finalCtx = finalCanvas.getContext('2d');
      if (!finalCtx) return;
      
      finalCanvas.width = targetWidth || 1;
      finalCanvas.height = targetHeight || 1;
      
      finalCtx.drawImage(
        tempCanvas,
        sX, sY, sW, sH,
        0, 0, finalCanvas.width, finalCanvas.height
      );
      
      finalCanvas.toBlob(
        (blob) => {
          if (blob) {
            setEstimatedSize(blob.size);
            if (previewUrl) {
              URL.revokeObjectURL(previewUrl);
            }
            setPreviewUrl(URL.createObjectURL(blob));
          }
        },
        compressionFormat,
        compressionFormat === 'image/png' ? undefined : compressionQuality
      );
    }, 300);
    
    return () => clearTimeout(timer);
  }, [originalImage, rotate, flipH, flipV, cropBox, targetWidth, targetHeight, compressionFormat, compressionQuality]);

  // Clean up preview URL on unmount only (revocation on update is handled inline in the estimation effect)
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update targetWidth & targetHeight when crop changes
  useEffect(() => {
    if (!originalImage) return;
    const isRotated90 = rotate === 90 || rotate === 270;
    const rotW = isRotated90 ? originalImage.naturalHeight : originalImage.naturalWidth;
    const rotH = isRotated90 ? originalImage.naturalWidth : originalImage.naturalHeight;
    
    const w = Math.round((cropBox.width / 100) * rotW);
    const h = Math.round((cropBox.height / 100) * rotH);
    
    setTargetWidth(w);
    setTargetHeight(h);
  }, [cropBox, rotate, originalImage]);

  // Resizing inputs handlers
  const handleTargetWidthChange = (val: number) => {
    setTargetWidth(val);
    if (aspectRatioLocked && val > 0 && originalImage) {
      const ratio = cropBox.height / cropBox.width;
      setTargetHeight(Math.round(val * ratio));
    }
  };

  const handleTargetHeightChange = (val: number) => {
    setTargetHeight(val);
    if (aspectRatioLocked && val > 0 && originalImage) {
      const ratio = cropBox.width / cropBox.height;
      setTargetWidth(Math.round(val * ratio));
    }
  };

  // Aspect ratio presets crop updater
  const applyCropPreset = (ratio: number | null) => {
    setCropAspectRatio(ratio);
    if (!ratio) return;
    
    let width = 80;
    let height = width / ratio;
    
    if (height > 80) {
      height = 80;
      width = height * ratio;
    }
    
    const left = (100 - width) / 2;
    const top = (100 - height) / 2;
    
    setCropBox({ left, top, width, height });
  };

  // Drag and resize handlers for Crop Overlay Box
  const handleDragStart = (e: React.MouseEvent, type: 'move' | 'nw' | 'ne' | 'sw' | 'se') => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragType(type);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialCropBox({ ...cropBox });
  };

  const handleTouchStart = (e: React.TouchEvent, type: 'move' | 'nw' | 'ne' | 'sw' | 'se') => {
    e.stopPropagation();
    const touch = e.touches[0];
    setIsDragging(true);
    setDragType(type);
    setDragStart({ x: touch.clientX, y: touch.clientY });
    setInitialCropBox({ ...cropBox });
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging || !dragType || !imageContainerRef.current) return;
    
    const rect = imageContainerRef.current.getBoundingClientRect();
    const pctX = ((clientX - dragStart.x) / rect.width) * 100;
    const pctY = ((clientY - dragStart.y) / rect.height) * 100;
    
    let left = initialCropBox.left;
    let top = initialCropBox.top;
    let width = initialCropBox.width;
    let height = initialCropBox.height;
    
    const minSize = 5;
    
    if (dragType === 'move') {
      left = Math.max(0, Math.min(100 - width, left + pctX));
      top = Math.max(0, Math.min(100 - height, top + pctY));
    } else {
      if (dragType === 'nw') {
        const maxLeft = initialCropBox.left + initialCropBox.width - minSize;
        const maxTop = initialCropBox.top + initialCropBox.height - minSize;
        
        left = Math.max(0, Math.min(maxLeft, left + pctX));
        top = Math.max(0, Math.min(maxTop, top + pctY));
        width = initialCropBox.left + initialCropBox.width - left;
        height = initialCropBox.top + initialCropBox.height - top;
      } else if (dragType === 'ne') {
        const maxTop = initialCropBox.top + initialCropBox.height - minSize;
        const maxWidth = 100 - left;
        
        top = Math.max(0, Math.min(maxTop, top + pctY));
        width = Math.max(minSize, Math.min(maxWidth, width + pctX));
        height = initialCropBox.top + initialCropBox.height - top;
      } else if (dragType === 'sw') {
        const maxLeft = initialCropBox.left + initialCropBox.width - minSize;
        const maxHeight = 100 - top;
        
        left = Math.max(0, Math.min(maxLeft, left + pctX));
        width = initialCropBox.left + initialCropBox.width - left;
        height = Math.max(minSize, Math.min(maxHeight, height + pctY));
      } else if (dragType === 'se') {
        const maxWidth = 100 - left;
        const maxHeight = 100 - top;
        
        width = Math.max(minSize, Math.min(maxWidth, width + pctX));
        height = Math.max(minSize, Math.min(maxHeight, height + pctY));
      }
      
      if (cropAspectRatio) {
        let newHeight = width / cropAspectRatio;
        if (top + newHeight > 100) {
          newHeight = 100 - top;
          width = newHeight * cropAspectRatio;
        }
        height = newHeight;
      }
    }
    
    setCropBox({ left, top, width, height });
  };

  useEffect(() => {
    if (!isDragging) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    
    const handleDragEnd = () => {
      setIsDragging(false);
      setDragType(null);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleDragEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  // cropAspectRatio is used inside handleDragMove and must be in deps to avoid stale closures
  }, [isDragging, dragType, initialCropBox, dragStart, cropAspectRatio]);

  // Utility to change extensions
  const changeExtension = (filePath: string, format: string): string => {
    const parts = filePath.split('.');
    if (parts.length > 1) {
      parts.pop();
    }
    const ext = format === 'image/webp' ? 'webp' : format === 'image/jpeg' ? 'jpg' : 'png';
    return `${parts.join('.')}.${ext}`;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0 || !bytes) return '—';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const calculateSavings = () => {
    if (!estimatedSize || !file.size) return 0;
    return Math.round(((file.size - estimatedSize) / file.size) * 100);
  };

  const handleReset = () => {
    if (!originalImage) return;
    setRotate(0);
    setFlipH(false);
    setFlipV(false);
    setCropMode(false);
    setCropBox({ left: 10, top: 10, width: 80, height: 80 });
    setCropAspectRatio(null);
    setAspectRatioLocked(true);
    setTargetWidth(originalImage.naturalWidth);
    setTargetHeight(originalImage.naturalHeight);
  };

  const handleCommitChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalImage || saving) return;
    
    setSaving(true);
    setSavingError(null);
    
    try {
      const isRotated90 = rotate === 90 || rotate === 270;
      
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error('Could not initialize intermediate context');
      
      const rotW = isRotated90 ? originalImage.naturalHeight : originalImage.naturalWidth;
      const rotH = isRotated90 ? originalImage.naturalWidth : originalImage.naturalHeight;
      tempCanvas.width = rotW;
      tempCanvas.height = rotH;
      
      tempCtx.translate(rotW / 2, rotH / 2);
      tempCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      tempCtx.rotate((rotate * Math.PI) / 180);
      tempCtx.drawImage(
        originalImage,
        -originalImage.naturalWidth / 2,
        -originalImage.naturalHeight / 2
      );
      
      const sX = (cropBox.left / 100) * rotW;
      const sY = (cropBox.top / 100) * rotH;
      const sW = (cropBox.width / 100) * rotW;
      const sH = (cropBox.height / 100) * rotH;
      
      const finalCanvas = document.createElement('canvas');
      const finalCtx = finalCanvas.getContext('2d');
      if (!finalCtx) throw new Error('Could not initialize final context');
      
      const finalW = (targetWidth && targetWidth > 0) ? targetWidth : (isRotated90 ? originalImage.naturalHeight : originalImage.naturalWidth);
      const finalH = (targetHeight && targetHeight > 0) ? targetHeight : (isRotated90 ? originalImage.naturalWidth : originalImage.naturalHeight);

      finalCanvas.width = finalW;
      finalCanvas.height = finalH;
      
      finalCtx.drawImage(
        tempCanvas,
        sX, sY, sW, sH,
        0, 0, finalW, finalH
      );
      
      finalCanvas.toBlob(
        async (blob) => {
          if (!blob) {
            setSaving(false);
            setSavingError('Failed to generate image blob output');
            return;
          }
          
          try {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
              try {
                const base64data = reader.result?.toString().split(',')[1] || '';
                
                const creds = {
                  token: session.token,
                  owner: session.owner,
                  repo: activeRepo.repo,
                  branch: activeRepo.branch
                };
                
                let existingSha: string | undefined = undefined;
                const cleanTargetPath = targetPath.trim().replace(/^\//, '');
                
                // Always fetch the current SHA from GitHub to avoid stale SHA errors
                // (e.g., when compressing the same file multiple times without refreshing)
                try {
                  const metaUrl = `https://api.github.com/repos/${creds.owner}/${creds.repo}/contents/${cleanTargetPath}?ref=${creds.branch}`;
                  const metaRes = await fetch(metaUrl, {
                    headers: {
                      Accept: 'application/vnd.github+json',
                      Authorization: `Bearer ${creds.token}`,
                      'X-GitHub-Api-Version': '2022-11-28',
                    },
                    cache: 'no-store',
                  });
                  if (metaRes.ok) {
                    const metaData = await metaRes.json();
                    existingSha = metaData.sha;
                  }
                  // If 404, the file doesn't exist yet — no sha needed (new file)
                } catch {
                  // Network error fetching metadata — fall back to local sha
                  const matchedFile = files.find(f => f.path === cleanTargetPath);
                  if (matchedFile) {
                    existingSha = matchedFile.sha;
                  } else if (cleanTargetPath === file.path) {
                    existingSha = file.sha;
                  }
                }
                
                const msg = commitMessage.trim() || `Optimize and edit image: ${file.name}`;
                
                // Upload new version
                await uploadFile(creds, cleanTargetPath, base64data, msg, existingSha);
                
                // Delete original if path changed
                const isPathChanged = cleanTargetPath !== file.path;
                if (isPathChanged && deleteOriginalOnFormatChange) {
                  await deleteFile(creds, file.path, file.sha, `Delete original file after conversion: ${file.name}`);
                }
                
                setSaving(false);
                setIsEditing(false);
                
                if (onFileModified) {
                  onFileModified();
                }
                
                onClose();
              } catch (innerErr: any) {
                console.error(innerErr);
                setSaving(false);
                setSavingError(innerErr.message || 'Error occurred while saving file contents');
              }
            };
            reader.onerror = () => {
              setSaving(false);
              setSavingError('Failed to read image blob as data URL');
            };
          } catch (err: any) {
            console.error(err);
            setSaving(false);
            setSavingError(err.message || 'Error occurred while saving file contents');
          }
        },
        compressionFormat,
        compressionFormat === 'image/png' ? undefined : compressionQuality
      );
    } catch (err: any) {
      console.error(err);
      setSaving(false);
      setSavingError(err.message || 'Failed to draw filters');
    }
  };

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

  // handleNext and handlePrev are now defined above as useCallback hooks

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
      {isEditing ? (
        <div className="image-editor-workspace">
          {/* Workspace left side (Image drawing area) */}
          <div className="editor-main-panel" ref={workspaceRef}>
            {originalImage ? (
              <div 
                className="canvas-crop-wrapper" 
                ref={imageContainerRef}
                style={{
                  width: displaySize.width,
                  height: displaySize.height,
                  position: 'relative'
                }}
              >
                {!cropMode && previewUrl ? (
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'contain',
                      display: 'block'
                    }} 
                  />
                ) : (
                  <canvas 
                    ref={canvasRef} 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      display: 'block' 
                    }} 
                  />
                )}
                
                {cropMode && (
                  <div 
                    className="crop-box-overlay"
                    style={{
                      left: `${cropBox.left}%`,
                      top: `${cropBox.top}%`,
                      width: `${cropBox.width}%`,
                      height: `${cropBox.height}%`
                    }}
                    onMouseDown={(e) => handleDragStart(e, 'move')}
                    onTouchStart={(e) => handleTouchStart(e, 'move')}
                  >
                    <div className="crop-grid-line-h h1"></div>
                    <div className="crop-grid-line-h h2"></div>
                    <div className="crop-grid-line-v v1"></div>
                    <div className="crop-grid-line-v v2"></div>
                    
                    <div className="crop-handle nw" onMouseDown={(e) => handleDragStart(e, 'nw')} onTouchStart={(e) => handleTouchStart(e, 'nw')}></div>
                    <div className="crop-handle ne" onMouseDown={(e) => handleDragStart(e, 'ne')} onTouchStart={(e) => handleTouchStart(e, 'ne')}></div>
                    <div className="crop-handle sw" onMouseDown={(e) => handleDragStart(e, 'sw')} onTouchStart={(e) => handleTouchStart(e, 'sw')}></div>
                    <div className="crop-handle se" onMouseDown={(e) => handleDragStart(e, 'se')} onTouchStart={(e) => handleTouchStart(e, 'se')}></div>
                  </div>
                )}
              </div>
            ) : imageError ? (
              <div className="preview-error">
                <AlertTriangle size={48} className="text-danger" />
                <h3>Editor Error</h3>
                <p>{imageError}</p>
              </div>
            ) : (
              <div className="preview-loading">
                <RefreshCw size={32} className="spin text-primary" />
                <span>Loading original canvas...</span>
              </div>
            )}
          </div>
          
          {/* Controls Sidebar right side */}
          <aside className="editor-sidebar">
            <div className="editor-sidebar-header">
              <Sliders size={16} className="text-primary" />
              <h3>Editor Controls</h3>
            </div>
            
            <div className="editor-sidebar-content">
              {/* Transform Section */}
              <div className="editor-section">
                <div className="editor-section-title">
                  <RotateCw size={12} /> Transform
                </div>
                <div className="editor-btn-row">
                  <button className="editor-btn" onClick={() => setRotate(prev => (prev - 90 + 360) % 360)} title="Rotate Left">
                    <RotateCcw size={14} /> 90°
                  </button>
                  <button className="editor-btn" onClick={() => setRotate(prev => (prev + 90) % 360)} title="Rotate Right">
                    <RotateCw size={14} /> 90°
                  </button>
                </div>
                <div className="editor-btn-row">
                  <button className={`editor-btn ${flipH ? 'active' : ''}`} onClick={() => setFlipH(!flipH)}>
                    <FlipHorizontal size={14} /> Flip H
                  </button>
                  <button className={`editor-btn ${flipV ? 'active' : ''}`} onClick={() => setFlipV(!flipV)}>
                    <FlipVertical size={14} /> Flip V
                  </button>
                </div>
              </div>
              
              {/* Crop & Presets Section */}
              <div className="editor-section">
                <div className="editor-section-title">
                  <Crop size={12} /> Crop Area
                </div>
                <button 
                  className={`editor-btn ${cropMode ? 'active' : ''}`} 
                  onClick={() => setCropMode(!cropMode)}
                  style={{ width: '100%', marginBottom: '0.25rem' }}
                >
                  <Crop size={14} /> {cropMode ? 'Disable Crop Box' : 'Enable Crop Box'}
                </button>
                
                {cropMode && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Aspect Ratio Presets:</span>
                    <div className="editor-btn-grid">
                      <button className={`editor-btn ${cropAspectRatio === null ? 'active' : ''}`} onClick={() => applyCropPreset(null)}>
                        Free
                      </button>
                      <button className={`editor-btn ${cropAspectRatio === 1 ? 'active' : ''}`} onClick={() => applyCropPreset(1)}>
                        1:1 (Square)
                      </button>
                      <button className={`editor-btn ${cropAspectRatio === 16/9 ? 'active' : ''}`} onClick={() => applyCropPreset(16/9)}>
                        16:9
                      </button>
                      <button className={`editor-btn ${cropAspectRatio === 4/3 ? 'active' : ''}`} onClick={() => applyCropPreset(4/3)}>
                        4:3
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Resizing dimensions Section */}
              <div className="editor-section">
                <div className="editor-section-title">
                  Resize Output (px)
                </div>
                <div className="editor-input-row">
                  <div className="editor-input-subgroup">
                    <label>Width</label>
                    <input 
                      type="number" 
                      className="editor-small-input"
                      value={targetWidth || ''}
                      onChange={(e) => handleTargetWidthChange(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  
                  <button 
                    className={`lock-aspect-btn ${aspectRatioLocked ? 'active' : ''}`}
                    onClick={() => setAspectRatioLocked(!aspectRatioLocked)}
                    title={aspectRatioLocked ? "Unlock Aspect Ratio" : "Lock Aspect Ratio"}
                  >
                    {aspectRatioLocked ? <Lock size={16} /> : <Unlock size={16} />}
                  </button>
                  
                  <div className="editor-input-subgroup">
                    <label>Height</label>
                    <input 
                      type="number" 
                      className="editor-small-input"
                      value={targetHeight || ''}
                      onChange={(e) => handleTargetHeightChange(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
                
                <button 
                  className="editor-btn" 
                  onClick={handleReset} 
                  style={{ width: '100%', marginTop: '0.25rem' }}
                >
                  Reset Dimensions
                </button>
              </div>
              
              {/* Compress & Export Format Section */}
              <div className="editor-section">
                <div className="editor-section-title">
                  Optimize & Compress
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="editor-input-subgroup">
                    <label>Export Format</label>
                    <select 
                      className="editor-select" 
                      value={compressionFormat} 
                      onChange={(e) => {
                        const newFormat = e.target.value;
                        setCompressionFormat(newFormat);
                        setTargetPath(changeExtension(targetPath, newFormat));
                      }}
                    >
                      <option value="image/webp">WebP (Recommended)</option>
                      <option value="image/jpeg">JPEG</option>
                      <option value="image/png">PNG (Lossless)</option>
                    </select>
                  </div>
                  
                  {compressionFormat !== 'image/png' && (
                    <div className="slider-container">
                      <div className="slider-labels">
                        <label>Quality</label>
                        <span>{Math.round(compressionQuality * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        className="editor-slider"
                        min="0.1" 
                        max="1.0" 
                        step="0.05"
                        value={compressionQuality}
                        onChange={(e) => setCompressionQuality(parseFloat(e.target.value))}
                      />
                    </div>
                  )}
                  
                  {/* Real-time size comparison metric card */}
                  <div className="size-comparison-card">
                    <div className="size-row">
                      <span>Original size:</span>
                      <span className="size-value">{formatSize(file.size)}</span>
                    </div>
                    <div className="size-row">
                      <span>Optimized size:</span>
                      <span className="size-value">
                        {estimatedSize ? formatSize(estimatedSize) : 'Estimating...'}
                      </span>
                    </div>
                    <div className="savings-row">
                      <span className="savings-label">Est. File Savings:</span>
                      <span className="savings-badge">
                        {calculateSavings() > 0 ? `-${calculateSavings()}% Saved` : 'No Savings'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Form commit save controls footer */}
            <form onSubmit={handleCommitChanges} className="editor-footer">
              {savingError && (
                <div style={{ color: 'var(--danger)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <AlertTriangle size={14} />
                  <span>{savingError}</span>
                </div>
              )}
              
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" style={{ fontSize: '0.75rem' }}>Save Path</label>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                  value={targetPath}
                  onChange={(e) => setTargetPath(e.target.value)}
                  required
                />
              </div>
              
              {targetPath.trim() !== file.path && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.25rem 0' }}>
                  <input 
                    type="checkbox" 
                    id="delete-original-check" 
                    checked={deleteOriginalOnFormatChange}
                    onChange={(e) => setDeleteOriginalOnFormatChange(e.target.checked)}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="delete-original-check" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    Delete original file after saving
                  </label>
                </div>
              )}
              
              <div className="input-group" style={{ marginBottom: '0.25rem' }}>
                <label className="input-label" style={{ fontSize: '0.75rem' }}>Commit Message</label>
                <textarea 
                  className="input-field" 
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', resize: 'none', height: '52px' }}
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  required
                />
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  style={{ flex: 1, padding: '0.55rem', fontSize: '0.85rem' }}
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1, padding: '0.55rem', fontSize: '0.85rem', background: '#10b981', boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)' }}
                  disabled={saving || !originalImage}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={14} className="spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save size={14} /> Commit Save
                    </>
                  )}
                </button>
              </div>
            </form>
          </aside>
        </div>
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
