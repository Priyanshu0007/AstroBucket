import React, { useState, useEffect, useRef } from 'react';
import type { GithubFile } from '../../lib/github';
import type { GithubSession } from '../../App';
import type { AttachedRepo } from './types';
import { MediaThumbnail } from './MediaThumbnail';
import { 
  Folder, 
  File as FileIcon, 
  Image as ImageIcon, 
  Code, 
  Upload, 
  Trash2, 
  Copy,
  ChevronRight,
  Home,
  RefreshCw,
  ExternalLink,
  Plus,
  Search,
  X,
  Eye,
  Grid,
  List,
  FileText,
  Video,
  Music
} from 'lucide-react';

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

const getFilesFromEntry = async (entry: any): Promise<{ file: File; relativePath: string }[]> => {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file((file: File) => {
        const cleanPath = entry.fullPath.startsWith('/') 
          ? entry.fullPath.substring(1) 
          : entry.fullPath;
        resolve([{ file, relativePath: cleanPath }]);
      });
    });
  } else if (entry.isDirectory) {
    const dirReader = entry.createReader();
    const readEntries = (): Promise<any[]> => {
      return new Promise((resolve, reject) => {
        dirReader.readEntries(resolve, reject);
      });
    };

    try {
      let entries: any[] = [];
      let readBatch = await readEntries();
      while (readBatch.length > 0) {
        entries = entries.concat(readBatch);
        readBatch = await readEntries();
      }

      const results = await Promise.all(
        entries.map((childEntry) => getFilesFromEntry(childEntry))
      );
      return results.flat();
    } catch (err) {
      console.error('Error reading directory entries', err);
      return [];
    }
  }
  return [];
};

const parseDroppedItems = async (items: DataTransferItemList): Promise<{ file: File; relativePath: string }[]> => {
  const entries: any[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry();
      if (entry) {
        entries.push(entry);
      }
    }
  }

  if (entries.length > 0) {
    const fileLists = await Promise.all(entries.map(entry => getFilesFromEntry(entry)));
    return fileLists.flat();
  }
  return [];
};

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
  const [dragActive, setDragActive] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: GithubFile } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Click outside to clear selection / context menu
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

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (uploading) return;
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      try {
        const filesList = await parseDroppedItems(e.dataTransfer.items);
        if (filesList.length > 0) {
          onUpload(filesList);
        }
      } catch (err) {
        console.error('Error scanning dropped files:', err);
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesList = Array.from(e.dataTransfer.files).map(file => ({
        file,
        relativePath: file.name
      }));
      onUpload(filesList);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploading) return;
    if (e.target.files && e.target.files.length > 0) {
      const filesList = Array.from(e.target.files).map(file => ({
        file,
        relativePath: file.name
      }));
      onUpload(filesList);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await onCreateFolder(newFolderName.trim());
    setNewFolderName('');
    setIsCreateFolderOpen(false);
  };

  const breadcrumbParts = currentPath.split('/').filter(Boolean);
  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(fileSearch.toLowerCase())
  );

  return (
    <>
      {/* Breadcrumbs Navigation */}
      <div className="breadcrumbs">
        <div 
          className={`breadcrumb-item ${breadcrumbParts.length === 0 ? 'breadcrumb-active' : ''}`}
          onClick={() => onNavigate('')}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <Home size={14} style={{ marginRight: '4px' }}/> Root
        </div>
        
        {breadcrumbParts.map((part, index) => (
          <React.Fragment key={index}>
            <ChevronRight size={14} className="breadcrumb-separator" />
            <div 
              className={`breadcrumb-item ${index === breadcrumbParts.length - 1 ? 'breadcrumb-active' : ''}`}
              onClick={() => onBreadcrumbClick(index)}
            >
              {part}
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Drag & Drop Upload Zone */}
      <div 
        className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
        style={{ marginBottom: '1.5rem' }}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          style={{ display: 'none' }} 
          ref={fileInputRef} 
          onChange={handleFileInput}
          multiple
        />
        <Upload size={40} className={uploading ? 'spin' : ''} style={{ color: uploading ? 'var(--primary)' : 'var(--text-muted)' }} />
        {uploading ? (
          <h3 className="text-primary" style={{ fontSize: '1.1rem' }}>Uploading files... (see progress panel)</h3>
        ) : (
          <div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>Drag & Drop to upload files or folders</h3>
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>or click to select multiple files from your machine</p>
          </div>
        )}
      </div>

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

      {/* Folder Creation Modal */}
      {isCreateFolderOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Create New Folder</h2>
              <button className="btn-icon" onClick={() => setIsCreateFolderOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateFolderSubmit}>
              <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                <label className="input-label">Folder Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. assets" 
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div style={{ display: 'flex', justifySelf: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsCreateFolderOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Right-click Context Menu */}
      {contextMenu && (
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
                setContextMenu(null);
              }}
            >
              <Eye size={14} /> Preview File
            </button>
          )}
          <button 
            className="context-menu-item" 
            onClick={() => {
              onCopyCdn(contextMenu.file);
              setContextMenu(null);
            }}
          >
            <Copy size={14} /> Copy CDN Link
          </button>
          <a 
            href={contextMenu.file.html_url} 
            target="_blank" 
            rel="noreferrer"
            className="context-menu-item-link"
            onClick={() => setContextMenu(null)}
          >
            <ExternalLink size={14} /> Open on GitHub
          </a>
          <div className="context-menu-divider" />
          <button 
            className="context-menu-item text-danger" 
            onClick={() => {
              onDelete(contextMenu.file);
              setContextMenu(null);
            }}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </>
  );
};
