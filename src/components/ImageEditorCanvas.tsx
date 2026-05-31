import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ImageEditorCanvasProps {
  originalImage: HTMLImageElement | null;
  previewUrl: string | null;
  cropMode: boolean;
  cropBox: { left: number; top: number; width: number; height: number };
  displaySize: { width: number; height: number };
  imageError: string | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  imageContainerRef: React.RefObject<HTMLDivElement | null>;
  handleDragStart: (e: React.MouseEvent, type: 'move' | 'nw' | 'ne' | 'sw' | 'se') => void;
  handleTouchStart: (e: React.TouchEvent, type: 'move' | 'nw' | 'ne' | 'sw' | 'se') => void;
}

export const ImageEditorCanvas: React.FC<ImageEditorCanvasProps> = ({
  originalImage,
  previewUrl,
  cropMode,
  cropBox,
  displaySize,
  imageError,
  canvasRef,
  imageContainerRef,
  handleDragStart,
  handleTouchStart
}) => {
  return (
    <div className="editor-main-panel">
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
  );
};
