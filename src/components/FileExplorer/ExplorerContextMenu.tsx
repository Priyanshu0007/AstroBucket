import React from 'react';
import { Eye, Copy, ExternalLink, Trash2 } from 'lucide-react';
import type { GithubFile } from '../../api/types';

interface ExplorerContextMenuProps {
  contextMenu: { x: number; y: number; file: GithubFile } | null;
  onClose: () => void;
  onPreviewFile: (file: GithubFile) => void;
  onCopyCdn: (file: GithubFile) => void;
  onDelete: (file: GithubFile) => void;
}

export const ExplorerContextMenu: React.FC<ExplorerContextMenuProps> = ({
  contextMenu,
  onClose,
  onPreviewFile,
  onCopyCdn,
  onDelete
}) => {
  if (!contextMenu) return null;

  return (
    <div 
      className="context-menu glass-panel" 
      style={{ 
        position: 'fixed',
        top: contextMenu.y, 
        left: contextMenu.x,
        zIndex: 1000 
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {contextMenu.file.type === 'file' && (
        <button 
          className="context-menu-item" 
          onClick={() => {
            onPreviewFile(contextMenu.file);
            onClose();
          }}
        >
          <Eye size={14} /> Preview File
        </button>
      )}
      <button 
        className="context-menu-item" 
        onClick={() => {
          onCopyCdn(contextMenu.file);
          onClose();
        }}
      >
        <Copy size={14} /> Copy CDN Link
      </button>
      <a 
        href={contextMenu.file.html_url} 
        target="_blank" 
        rel="noreferrer"
        className="context-menu-item-link"
        onClick={onClose}
      >
        <ExternalLink size={14} /> Open on GitHub
      </a>
      <div className="context-menu-divider" />
      <button 
        className="context-menu-item text-danger" 
        onClick={() => {
          onDelete(contextMenu.file);
          onClose();
        }}
      >
        <Trash2 size={14} /> Delete
      </button>
    </div>
  );
};
