import React, { useState, useEffect, useRef } from 'react';
import type { GithubFile } from '../api/types';
import type { GithubSession } from '../App';
import type { AttachedRepo } from './FileExplorer/types';
import { uploadFile, deleteFile, apiClient } from '../api/client';
import { ImageEditorCanvas } from './ImageEditorCanvas';
import { ImageEditorSidebar } from './ImageEditorSidebar';
import { changeExtension, drawTransformedImage, calculateNewCropBox, drawToCanvas } from './ImageEditorUtils';

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
    
    drawToCanvas(canvasRef.current, originalImage, cropMode, {
      rotate,
      flipH,
      flipV,
      cropBox,
      targetWidth,
      targetHeight
    });
  }, [originalImage, rotate, flipH, flipV, cropMode, cropBox, targetWidth, targetHeight]);

  // Debounced estimation of compressed file size
  useEffect(() => {
    if (!originalImage) return;
    
    const timer = setTimeout(() => {
      const finalCanvas = drawTransformedImage(originalImage, {
        rotate,
        flipH,
        flipV,
        cropBox,
        targetWidth,
        targetHeight
      });
      
      if (!finalCanvas) return;
      
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
    const newBox = calculateNewCropBox({
      dragType,
      clientX,
      clientY,
      dragStartX: dragStart.x,
      dragStartY: dragStart.y,
      containerRect: rect,
      initialCropBox,
      cropAspectRatio
    });
    
    setCropBox(newBox);
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
      const finalCanvas = drawTransformedImage(originalImage, {
        rotate,
        flipH,
        flipV,
        cropBox,
        targetWidth,
        targetHeight
      });
      
      if (!finalCanvas) {
        throw new Error('Could not transform and draw image');
      }
      
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
    <div className="image-editor-workspace" ref={workspaceRef}>
      <ImageEditorCanvas 
        originalImage={originalImage}
        previewUrl={previewUrl}
        cropMode={cropMode}
        cropBox={cropBox}
        displaySize={displaySize}
        imageError={imageError}
        canvasRef={canvasRef}
        imageContainerRef={imageContainerRef}
        handleDragStart={handleDragStart}
        handleTouchStart={handleTouchStart}
      />
      
      <ImageEditorSidebar 
        rotate={rotate}
        setRotate={setRotate}
        flipH={flipH}
        setFlipH={setFlipH}
        flipV={flipV}
        setFlipV={setFlipV}
        cropMode={cropMode}
        setCropMode={setCropMode}
        cropAspectRatio={cropAspectRatio}
        applyCropPreset={applyCropPreset}
        targetWidth={targetWidth}
        handleTargetWidthChange={handleTargetWidthChange}
        targetHeight={targetHeight}
        handleTargetHeightChange={handleTargetHeightChange}
        aspectRatioLocked={aspectRatioLocked}
        setAspectRatioLocked={setAspectRatioLocked}
        compressionFormat={compressionFormat}
        setCompressionFormat={setCompressionFormat}
        compressionQuality={compressionQuality}
        setCompressionQuality={setCompressionQuality}
        estimatedSize={estimatedSize}
        originalSize={file.size || 0}
        targetPath={targetPath}
        setTargetPath={setTargetPath}
        commitMessage={commitMessage}
        setCommitMessage={setCommitMessage}
        deleteOriginalOnFormatChange={deleteOriginalOnFormatChange}
        setDeleteOriginalOnFormatChange={setDeleteOriginalOnFormatChange}
        saving={saving}
        savingError={savingError}
        originalImage={originalImage}
        handleReset={handleReset}
        handleCommitChanges={handleCommitChanges}
        onExitEditor={onExitEditor}
        originalFilePath={file.path}
      />
    </div>
  );
};
