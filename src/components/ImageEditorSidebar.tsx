import React from 'react';
import { 
  Sliders, 
  RotateCw, 
  RotateCcw, 
  Lock, 
  Unlock, 
  Save, 
  FlipHorizontal, 
  FlipVertical,
  AlertTriangle,
  RefreshCw,
  Crop
} from 'lucide-react';
import { formatSize, calculateSavings, changeExtension } from './ImageEditorUtils';

interface ImageEditorSidebarProps {
  rotate: number;
  setRotate: React.Dispatch<React.SetStateAction<number>>;
  flipH: boolean;
  setFlipH: (val: boolean) => void;
  flipV: boolean;
  setFlipV: (val: boolean) => void;
  cropMode: boolean;
  setCropMode: (val: boolean) => void;
  cropAspectRatio: number | null;
  applyCropPreset: (ratio: number | null) => void;
  targetWidth: number;
  handleTargetWidthChange: (val: number) => void;
  targetHeight: number;
  handleTargetHeightChange: (val: number) => void;
  aspectRatioLocked: boolean;
  setAspectRatioLocked: (val: boolean) => void;
  compressionFormat: string;
  setCompressionFormat: (val: string) => void;
  compressionQuality: number;
  setCompressionQuality: (val: number) => void;
  estimatedSize: number | null;
  originalSize: number;
  targetPath: string;
  setTargetPath: (val: string) => void;
  commitMessage: string;
  setCommitMessage: (val: string) => void;
  deleteOriginalOnFormatChange: boolean;
  setDeleteOriginalOnFormatChange: (val: boolean) => void;
  saving: boolean;
  savingError: string | null;
  originalImage: HTMLImageElement | null;
  handleReset: () => void;
  handleCommitChanges: (e: React.FormEvent) => Promise<void>;
  onExitEditor: () => void;
  originalFilePath: string;
}

export const ImageEditorSidebar: React.FC<ImageEditorSidebarProps> = ({
  rotate: _rotate,
  setRotate,
  flipH,
  setFlipH,
  flipV,
  setFlipV,
  cropMode,
  setCropMode,
  cropAspectRatio,
  applyCropPreset,
  targetWidth,
  handleTargetWidthChange,
  targetHeight,
  handleTargetHeightChange,
  aspectRatioLocked,
  setAspectRatioLocked,
  compressionFormat,
  setCompressionFormat,
  compressionQuality,
  setCompressionQuality,
  estimatedSize,
  originalSize,
  targetPath,
  setTargetPath,
  commitMessage,
  setCommitMessage,
  deleteOriginalOnFormatChange,
  setDeleteOriginalOnFormatChange,
  saving,
  savingError,
  originalImage,
  handleReset,
  handleCommitChanges,
  onExitEditor,
  originalFilePath
}) => {
  return (
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
                <span className="size-value">{formatSize(originalSize)}</span>
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
                  {calculateSavings(originalSize, estimatedSize) > 0 ? `-${calculateSavings(originalSize, estimatedSize)}% Saved` : 'No Savings'}
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
        
        {targetPath.trim() !== originalFilePath && (
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
  );
};
