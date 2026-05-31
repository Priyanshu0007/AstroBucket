import React, { useState, useEffect, useRef } from 'react';
import { 
  Sliders, 
  Crop, 
  RotateCw, 
  RotateCcw, 
  Lock, 
  Unlock, 
  Save, 
  FlipHorizontal, 
  FlipVertical,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import type { GithubFile } from '../api/types';
import type { GithubSession } from '../App';
import type { AttachedRepo } from './FileExplorer/types';
import { uploadFile, deleteFile, apiClient } from '../api/client';

// Import CSS
import '../styles/editor.css';

interface ImageEditorProps {
  file: GithubFile;
  session: GithubSession;
  activeRepo: AttachedRepo;
  objectUrl: string;
  files: GithubFile[];
  onExitEditor: () => void;
  onClose: () => void;
  onFileModified?: () => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({
  file,
  session,
  activeRepo,
  objectUrl,
  files,
  onExitEditor,
  onClose,
  onFileModified
}) => {
  // Image Editor States
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

  // Utility to change extensions
  const changeExtension = (filePath: string, format: string): string => {
    const parts = filePath.split('.');
    if (parts.length > 1) {
      parts.pop();
    }
    const ext = format === 'image/webp' ? 'webp' : format === 'image/jpeg' ? 'jpg' : 'png';
    return `${parts.join('.')}.${ext}`;
  };

  // Load Image element for Canvas editing
  useEffect(() => {
    if (objectUrl) {
      setImageError(null);
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
  }, [objectUrl, file.path, file.name]);

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
      // intermediate transformations
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

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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
  }, [isDragging, dragType, initialCropBox, dragStart, cropAspectRatio]);

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
                
                try {
                  const metaRes = await apiClient.get(`/repos/${creds.owner}/${creds.repo}/contents/${cleanTargetPath}`, {
                    params: { ref: creds.branch },
                    headers: {
                      Authorization: `Bearer ${creds.token}`
                    }
                  });
                  existingSha = metaRes.data.sha;
                } catch {
                  const matchedFile = files.find(f => f.path === cleanTargetPath);
                  if (matchedFile) {
                    existingSha = matchedFile.sha;
                  } else if (cleanTargetPath === file.path) {
                    existingSha = file.sha;
                  }
                }
                
                const msg = commitMessage.trim() || `Optimize and edit image: ${file.name}`;
                
                await uploadFile(creds, cleanTargetPath, base64data, msg, existingSha);
                
                const isPathChanged = cleanTargetPath !== file.path;
                if (isPathChanged && deleteOriginalOnFormatChange) {
                  await deleteFile(creds, file.path, file.sha, `Delete original file after conversion: ${file.name}`);
                }
                
                setSaving(false);
                onExitEditor();
                
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

  return (
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
              onClick={onExitEditor}
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
  );
};
