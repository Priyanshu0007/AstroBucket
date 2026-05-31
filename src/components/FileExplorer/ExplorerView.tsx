import React, { useState, useEffect } from 'react';
import type { GithubFile } from '../../api/types';
import type { GithubSession } from '../../App';
import type { AttachedRepo } from './types';
import { MediaThumbnail } from './MediaThumbnail';
import { 
  Folder, 
  File as FileIcon, 
  Image as ImageIcon, 
  Code, 
  Trash2, 
  Copy,
  Plus,
  Search,
  X,
  Eye,
  Grid,
  List,
  FileText,
  Video,
  Music,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { Breadcrumbs } from './Breadcrumbs';
import { UploadZone } from './UploadZone';
import { FolderCreationModal } from './FolderCreationModal';
import { ExplorerContextMenu } from './ExplorerContextMenu';

interface ExplorerViewProps {
  session: GithubSession;
  activeRepo: AttachedRepo;
  files: GithubFile[];
  loading: boolean;
  uploading: boolean;
  currentPath: string;
  selectedFileSha: string | null;
  setSelectedFileSha: (sha: string | null) => void;
  onNavigate: (path: string) => void;
  onBreadcrumbClick: (index: number) => void;
  onUpload: (files: { file: File; relativePath: string }[]) => void;
  onCopyCdn: (file: GithubFile) => void;
  onDelete: (file: GithubFile) => void;
  onPreviewFile: (file: GithubFile) => void;
  onCreateFolder: (folderName: string) => Promise<void>;
}

export const ExplorerView: React.FC<ExplorerViewProps> = ({
  session,
  activeRepo,
  files,
  loading,
  uploading,
  currentPath,
  selectedFileSha,
  setSelectedFileSha,
  onNavigate,
  onBreadcrumbClick,
  onUpload,
  onCopyCdn,
  onDelete,
  onPreviewFile,
  onCreateFolder
}) => {
  const [fileSearch, setFileSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: GithubFile } | null>(null);

  // Click outside to clear context menu
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0 || !bytes) return '—';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const getListFileIcon = (file: GithubFile) => {
    if (file.type === 'dir') return <Folder size={18} style={{ color: 'var(--primary)' }} />;
    
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'];
    const videoExts = ['mp4', 'webm', 'ogg', 'mov'];
    const audioExts = ['mp3', 'wav', 'ogg', 'm4a'];
    const codeExts = ['html', 'css', 'js', 'ts', 'jsx', 'tsx', 'json', 'md', 'py', 'java', 'go', 'rs'];
    const sheetExts = ['xlsx', 'xls', 'csv'];
    const docxExts = ['docx'];

    if (imageExts.includes(ext)) return <ImageIcon size={18} style={{ color: '#38bdf8' }} />;
    if (videoExts.includes(ext)) return <Video size={18} style={{ color: '#ec4899' }} />;
    if (audioExts.includes(ext)) return <Music size={18} style={{ color: '#a855f7' }} />;
    if (ext === 'pdf') return <FileText size={18} style={{ color: '#f43f5e' }} />;
    if (sheetExts.includes(ext)) return <FileText size={18} style={{ color: '#10b981' }} />;
    if (docxExts.includes(ext)) return <FileText size={18} style={{ color: '#3b82f6' }} />;
    if (codeExts.includes(ext)) return <Code size={18} style={{ color: '#f59e0b' }} />;
    return <FileIcon size={18} />;
  };

  const handleContextMenu = (e: React.MouseEvent, file: GithubFile) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFileSha(file.sha);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      file
    });
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(fileSearch.toLowerCase())
  );

  return (
    <>
      <Breadcrumbs 
        currentPath={currentPath}
        onNavigate={onNavigate}
        onBreadcrumbClick={onBreadcrumbClick}
      />

      <UploadZone 
        uploading={uploading}
        onUpload={onUpload}
      />

      {/* File List Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="search-bar-wrapper" style={{ flex: 1, maxWidth: '400px', minWidth: '200px' }}>
          <Search size={16} className="search-bar-icon" />
          <input 
            type="text" 
            className="input-field search-bar-input" 
            placeholder="Filter files by name..." 
            value={fileSearch}
            onChange={(e) => setFileSearch(e.target.value)}
          />
          {fileSearch && (
            <button className="search-clear-btn" onClick={() => setFileSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View Mode Toggle */}
          <div className="view-mode-toggle glass-card" style={{ display: 'flex', padding: '2px', gap: '2px' }}>
            <button 
              className={`btn-icon ${viewMode === 'grid' ? 'active-toggle' : ''}`} 
              onClick={() => setViewMode('grid')}
              title="Grid View"
              style={{ padding: '0.35rem' }}
            >
              <Grid size={15} />
            </button>
            <button 
              className={`btn-icon ${viewMode === 'list' ? 'active-toggle' : ''}`} 
              onClick={() => setViewMode('list')}
              title="List View"
              style={{ padding: '0.35rem' }}
            >
              <List size={15} />
            </button>
          </div>

          <button className="btn btn-primary" onClick={() => setIsCreateFolderOpen(true)}>
            <Plus size={16} /> New Folder
          </button>
          <span className="text-muted" style={{ fontSize: '0.85rem', marginLeft: '0.5rem' }}>
            {filteredFiles.length} item{filteredFiles.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* File Listing Container */}
      {loading && !uploading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem' }}>
          <RefreshCw size={28} className="spin text-muted" />
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            /* GRID VIEW */
            <div className="file-grid">
              {filteredFiles.map((file) => {
                const isSelected = selectedFileSha === file.sha;
                return (
                  <div 
                    className={`file-item glass-card ${isSelected ? 'selected' : ''}`} 
                    key={file.sha}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFileSha(file.sha);
                    }}
                    onDoubleClick={() => {
                      if (file.type === 'dir') {
                        onNavigate(file.path);
                      } else {
                        onPreviewFile(file);
                      }
                    }}
                    onContextMenu={(e) => handleContextMenu(e, file)}
                  >
                    <div className="file-thumbnail-container">
                      <MediaThumbnail 
                        file={file} 
                        creds={{
                          token: session.token,
                          owner: session.owner,
                          repo: activeRepo.repo,
                          branch: activeRepo.branch
                        }}
                      />
                    </div>
                    
                    <div className="file-details">
                      <div className="file-name" title={file.name}>{file.name}</div>
                      <div className="file-meta-info">
                        <span>{file.type === 'dir' ? 'Folder' : (file.name.split('.').pop() || '').toUpperCase()}</span>
                        <span>{file.type === 'dir' ? '—' : formatBytes(file.size)}</span>
                      </div>
                    </div>
                    
                    <div className="file-actions">
                      {file.type === 'file' && (
                        <button 
                          className="btn-icon" 
                          onClick={(e) => {
                            e.stopPropagation();
                            onPreviewFile(file);
                          }}
                          title="Preview File"
                        >
                          <Eye size={15} />
                        </button>
                      )}
                      <button 
                        className="btn-icon" 
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopyCdn(file);
                        }}
                        title="Copy CDN Link"
                      >
                        <Copy size={15} />
                      </button>
                      <button 
                        className="btn-icon" 
                        style={{ color: 'var(--danger)' }} 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(file);
                        }}
                        title="Delete File"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {filteredFiles.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
                  No files or directories found.
                </div>
              )}
            </div>
          ) : (
            /* LIST VIEW */
            <div className="file-list-view glass-panel">
              <table className="file-list-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((file) => {
                    const isSelected = selectedFileSha === file.sha;
                    const ext = file.name.split('.').pop()?.toUpperCase() || '';
                    const displayType = file.type === 'dir' ? 'Folder' : `${ext} File`;
                    return (
                      <tr 
                        key={file.sha} 
                        className={isSelected ? 'selected' : ''}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFileSha(file.sha);
                        }}
                        onDoubleClick={() => {
                          if (file.type === 'dir') {
                            onNavigate(file.path);
                          } else {
                            onPreviewFile(file);
                          }
                        }}
                        onContextMenu={(e) => handleContextMenu(e, file)}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {getListFileIcon(file)}
                            <span className="file-list-name-text">{file.name}</span>
                          </div>
                        </td>
                        <td className="text-muted">{displayType}</td>
                        <td className="text-muted">{file.type === 'dir' ? '—' : formatBytes(file.size)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                            {file.type === 'file' && (
                              <button 
                                className="btn-icon" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPreviewFile(file);
                                }}
                                title="Preview File"
                              >
                                <Eye size={14} />
                              </button>
                            )}
                            <button 
                              className="btn-icon" 
                              onClick={(e) => {
                                  e.stopPropagation();
                                  onCopyCdn(file);
                              }}
                              title="Copy CDN"
                            >
                              <Copy size={14} />
                            </button>
                            <a 
                              href={file.html_url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="btn-icon"
                              onClick={(e) => e.stopPropagation()}
                              title="View on GitHub"
                            >
                              <ExternalLink size={14} />
                            </a>
                            <button 
                              className="btn-icon" 
                              style={{ color: 'var(--danger)' }} 
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(file);
                              }}
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredFiles.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
                        No files or directories found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Folder Creation Modal Overlay */}
      <FolderCreationModal 
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onCreateFolder={onCreateFolder}
      />

      {/* Right-click Context Menu */}
      <ExplorerContextMenu 
        contextMenu={contextMenu}
        onClose={() => setContextMenu(null)}
        onPreviewFile={onPreviewFile}
        onCopyCdn={onCopyCdn}
        onDelete={onDelete}
      />
    </>
  );
};
