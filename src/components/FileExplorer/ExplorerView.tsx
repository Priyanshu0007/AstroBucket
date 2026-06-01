import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { GithubFile, GithubTreeItem } from '../../api/types';
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
  RefreshCw,
  MapPin,
  Download,
  AlertCircle
} from 'lucide-react';
import { Breadcrumbs } from './Breadcrumbs';
import { UploadZone } from './UploadZone';
import { FolderCreationModal } from './FolderCreationModal';
import { ExplorerContextMenu } from './ExplorerContextMenu';
import { getCdnUrl, fetchFileRaw, uploadFile, deleteFile, fileToBase64 } from '../../api/client';

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
  repoTree?: GithubTreeItem[];
  onBatchDelete?: (items: GithubFile[]) => Promise<void>;
  onBatchDownload?: (items: GithubFile[]) => Promise<void>;
  onRefresh?: () => void;
  isPrivate?: boolean;
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
  onCreateFolder,
  repoTree = [],
  onBatchDelete,
  onBatchDownload,
  onRefresh,
  isPrivate = false
}) => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: GithubFile } | null>(null);

  // Advanced States
  const [draggedOverPath, setDraggedOverPath] = useState<string | null>(null);
  const [movingItems, setMovingItems] = useState<Record<string, 'loading' | 'success'>>({});
  const [selectedItems, setSelectedItems] = useState<GithubFile[]>([]);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [highlightedSha, setHighlightedSha] = useState<string | null>(null);

  // Clear selectedFileSha after a delay so that locate highlights clear automatically
  useEffect(() => {
    if (selectedFileSha) {
      const timer = setTimeout(() => {
        setSelectedFileSha(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [selectedFileSha, setSelectedFileSha]);

  const searchWrapperRef = React.useRef<HTMLDivElement>(null);

  // Click outside to clear context menu
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Click outside to close global search dropdown
  useEffect(() => {
    const handleClickOutsideSearch = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setGlobalSearchQuery('');
      }
    };
    window.addEventListener('mousedown', handleClickOutsideSearch);
    return () => window.removeEventListener('mousedown', handleClickOutsideSearch);
  }, []);

  // Clear batch selection when navigating folders or files change
  useEffect(() => {
    setSelectedItems([]);
  }, [currentPath, files]);

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

  // Helper to map tree items to full GithubFile structures
  const mapTreeItemToFile = (item: GithubTreeItem): GithubFile => {
    const name = item.path.split('/').pop() || '';
    const type = item.type === 'blob' ? 'file' : 'dir';
    return {
      name,
      path: item.path,
      sha: item.sha,
      size: item.size || 0,
      url: item.url || '',
      html_url: `https://github.com/${session.owner}/${activeRepo.repo}/${type === 'file' ? 'blob' : 'tree'}/${activeRepo.branch}/${item.path}`,
      git_url: item.url || '',
      download_url: `https://raw.githubusercontent.com/${session.owner}/${activeRepo.repo}/${activeRepo.branch}/${item.path}`,
      type
    };
  };

  // Global search matching
  const searchResults = React.useMemo(() => {
    if (!globalSearchQuery.trim() || !repoTree) return [];
    const query = globalSearchQuery.toLowerCase();
    return repoTree
      .filter(item => {
        if (item.path.endsWith('.gitkeep')) return false;
        const name = item.path.split('/').pop() || '';
        return name.toLowerCase().includes(query) || item.path.toLowerCase().includes(query);
      })
      .slice(0, 50);
  }, [globalSearchQuery, repoTree]);

  // Locate file and pulse-highlight it
  const handleLocate = (e: React.MouseEvent, item: GithubTreeItem) => {
    e.stopPropagation();
    setGlobalSearchQuery('');
    
    const parts = item.path.split('/');
    const isFile = item.type === 'blob';
    if (isFile) {
      parts.pop(); // Remove the file name to get parent folder
    }
    const parentFolder = parts.join('/');
    onNavigate(parentFolder);
    
    setHighlightedSha(item.sha);
    setSelectedFileSha(item.sha);
    setTimeout(() => {
      setHighlightedSha(null);
    }, 3000);
  };

  // Checkbox Selection Logic
  const handleToggleSelect = (e: React.MouseEvent | React.ChangeEvent, file: GithubFile) => {
    e.stopPropagation();
    setSelectedItems(prev => {
      const exists = prev.some(item => item.sha === file.sha);
      if (exists) {
        return prev.filter(item => item.sha !== file.sha);
      } else {
        return [...prev, file];
      }
    });
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedItems(files);
    } else {
      setSelectedItems([]);
    }
  };

  const handleBatchCopyCdn = () => {
    const fileItems = selectedItems.filter(i => i.type === 'file');
    if (fileItems.length === 0) {
      alert('No files selected (directories do not have CDN links).');
      return;
    }
    const urls = fileItems
      .map(file => getCdnUrl(session.owner, activeRepo.repo, activeRepo.branch, file.path))
      .join('\n');
    navigator.clipboard.writeText(urls);
    if (isPrivate) {
      alert(`🔒 Copied CDN links for ${fileItems.length} file(s) to clipboard!\n\nNote: This repository is PRIVATE. These CDN links will NOT resolve publicly.`);
    } else {
      alert(`Copied CDN links for ${fileItems.length} file(s) to clipboard.`);
    }
    setSelectedItems([]);
  };

  const handleBatchDeleteClick = async () => {
    if (onBatchDelete) {
      await onBatchDelete(selectedItems);
      setSelectedItems([]);
    }
  };

  const handleBatchDownloadClick = async () => {
    if (onBatchDownload) {
      await onBatchDownload(selectedItems);
      setSelectedItems([]);
    }
  };

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, file: GithubFile) => {
    e.dataTransfer.setData('text/plain', file.path);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, folder: GithubFile) => {
    e.preventDefault();
    if (folder.type === 'dir') {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragEnter = (e: React.DragEvent, folder: GithubFile) => {
    e.preventDefault();
    if (folder.type === 'dir') {
      setDraggedOverPath(folder.path);
    }
  };

  const handleDragLeave = () => {
    setDraggedOverPath(null);
  };

  const handleDrop = async (e: React.DragEvent, targetFolder: GithubFile) => {
    e.preventDefault();
    setDraggedOverPath(null);
    if (targetFolder.type !== 'dir') return;

    const oldPath = e.dataTransfer.getData('text/plain');
    if (!oldPath || oldPath === targetFolder.path) return;

    const fileName = oldPath.split('/').pop() || '';
    const newPath = targetFolder.path 
      ? `${targetFolder.path}/${fileName}` 
      : fileName;

    if (oldPath === newPath) return;

    // Find the file in our local list or recursive tree
    const draggedFile = files.find(f => f.path === oldPath) || 
      (repoTree && repoTree.find(t => t.path === oldPath));

    if (!draggedFile) return;

    const resolvedFile = 'type' in draggedFile ? draggedFile : mapTreeItemToFile(draggedFile);

    let finalPath = newPath;
    let existingSha: string | undefined = undefined;

    // Handle Name Collisions
    const existingItem = repoTree.find(t => t.path === newPath);
    if (existingItem) {
      const choice = confirm(
        `A file named "${fileName}" already exists in "${targetFolder.name}".\n\nClick OK to OVERWRITE the existing file.\nClick Cancel to RENAME the moved file automatically.`
      );
      if (choice) {
        existingSha = existingItem.sha;
      } else {
        const extIndex = fileName.lastIndexOf('.');
        const namePart = extIndex !== -1 ? fileName.substring(0, extIndex) : fileName;
        const extPart = extIndex !== -1 ? fileName.substring(extIndex) : '';
        
        let counter = 1;
        let tempPath = newPath;
        while (repoTree.some(t => t.path === tempPath)) {
          const newName = `${namePart} (${counter})${extPart}`;
          tempPath = targetFolder.path ? `${targetFolder.path}/${newName}` : newName;
          counter++;
        }
        finalPath = tempPath;
      }
    }

    setMovingItems(prev => ({
      ...prev,
      [oldPath]: 'loading',
      [targetFolder.path]: 'loading'
    }));

    try {
      const creds = {
        token: session.token,
        owner: session.owner,
        repo: activeRepo.repo,
        branch: activeRepo.branch
      };

      // Move Sequence: Read -> Write -> Delete
      const blob = await fetchFileRaw(creds, oldPath);
      const base64 = await fileToBase64(new File([blob], fileName));
      await uploadFile(creds, finalPath, base64, `Move ${fileName} to ${targetFolder.path}`, existingSha);
      await deleteFile(creds, oldPath, resolvedFile.sha, `Delete original after move`);

      // Wait 600ms for GitHub API index update replication
      await new Promise(resolve => setTimeout(resolve, 600));

      // Invalidate queries to refresh caching layer
      queryClient.invalidateQueries({
        queryKey: ['repoContents', session.owner, activeRepo.repo, activeRepo.branch],
      });
      queryClient.invalidateQueries({
        queryKey: ['repoTree', session.owner, activeRepo.repo, activeRepo.branch],
      });
    } catch (err: any) {
      console.error(err);
      alert(`Failed to move file: ${err.message || 'Unknown error'}`);
    } finally {
      setMovingItems(prev => {
        const copy = { ...prev };
        delete copy[oldPath];
        delete copy[targetFolder.path];
        return copy;
      });
      if (onRefresh) {
        onRefresh();
      }
    }
  };

  const filteredFiles = files;

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

      {isPrivate && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.05)',
          border: '1px solid rgba(239, 68, 68, 0.15)',
          borderRadius: '8px',
          padding: '0.65rem 1rem',
          fontSize: '0.85rem',
          color: '#f87171',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginTop: '1rem',
          marginBottom: '0.5rem',
          lineHeight: '1.4'
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>
            <strong>🔒 Private Repository:</strong> Assets are served securely. Note that jsDelivr CDN links will <strong>not resolve publicly</strong> because the CDN cannot access private code.
          </span>
        </div>
      )}

      {/* Floating Batch Action Bar */}
      {selectedItems.length > 0 && (
        <div className="batch-action-bar">
          <div className="batch-action-left">
            <input 
              type="checkbox" 
              className="file-checkbox" 
              checked={selectedItems.length === filteredFiles.length}
              onChange={handleSelectAll}
            />
            <span className="batch-action-count">
              {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="batch-action-right">
            <button className="btn btn-outline" onClick={handleBatchCopyCdn} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              <Copy size={14} /> Copy CDN Links
            </button>
            <button className="btn btn-outline" onClick={handleBatchDownloadClick} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              <Download size={14} /> Download ZIP
            </button>
            <button className="btn btn-danger" onClick={handleBatchDeleteClick} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              <Trash2 size={14} /> Delete
            </button>
            <button className="btn-icon" onClick={() => setSelectedItems([])} title="Clear Selection">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* File List Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
        {/* Global Search Bar Wrapper */}
        <div ref={searchWrapperRef} className="search-bar-wrapper" style={{ flex: 1, maxWidth: '400px', minWidth: '200px' }}>
          <Search size={16} className="search-bar-icon" />
          <input 
            type="text" 
            className="input-field search-bar-input" 
            placeholder="Search repository globally..." 
            value={globalSearchQuery}
            onChange={(e) => setGlobalSearchQuery(e.target.value)}
          />
          {globalSearchQuery && (
            <button className="search-clear-btn" onClick={() => setGlobalSearchQuery('')}>
              <X size={14} />
            </button>
          )}

          {/* Search Dropdown Results */}
          {globalSearchQuery.trim() && (
            <div className="search-results-dropdown">
              {searchResults.length > 0 ? (
                searchResults.map(item => {
                  const isFile = item.type === 'blob';
                  const mappedFile = mapTreeItemToFile(item);
                  return (
                    <div 
                      key={item.sha} 
                      className="search-result-item"
                      onClick={() => {
                        if (isFile) {
                          onPreviewFile(mappedFile);
                        } else {
                          onNavigate(item.path);
                          setGlobalSearchQuery('');
                        }
                      }}
                    >
                      <div className="search-result-left">
                        <span className="search-result-icon">
                          {isFile ? getListFileIcon(mappedFile) : <Folder size={16} style={{ color: 'var(--primary)' }} />}
                        </span>
                        <div className="search-result-info">
                          <span className="search-result-name">{mappedFile.name}</span>
                          <span className="search-result-path">{item.path}</span>
                        </div>
                      </div>
                      <div className="search-result-actions">
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', gap: '0.25rem' }}
                          onClick={(e) => handleLocate(e, item)}
                        >
                          <MapPin size={12} /> Locate
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No matching files or directories found.
                </div>
              )}
            </div>
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
                const isItemChecked = selectedItems.some(i => i.sha === file.sha);
                const isHighlighted = highlightedSha === file.sha || selectedFileSha === file.sha;
                return (
                  <div 
                    className={`file-item glass-card ${isItemChecked ? 'selected' : ''} ${isHighlighted ? 'pulse-highlight' : ''} ${file.type === 'file' ? 'draggable-item' : ''} ${draggedOverPath === file.path ? 'drag-over' : ''}`} 
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

                    // Drag and Drop Card attributes
                    draggable={file.type === 'file'}
                    onDragStart={file.type === 'file' ? (e) => handleDragStart(e, file) : undefined}
                    onDragOver={file.type === 'dir' ? (e) => handleDragOver(e, file) : undefined}
                    onDragEnter={file.type === 'dir' ? (e) => handleDragEnter(e, file) : undefined}
                    onDragLeave={file.type === 'dir' ? handleDragLeave : undefined}
                    onDrop={file.type === 'dir' ? (e) => handleDrop(e, file) : undefined}
                  >
                    {/* Item Moving Loader Overlay */}
                    {movingItems[file.path] === 'loading' && (
                      <div className="item-moving-overlay">
                        <RefreshCw size={20} className="spin" />
                        <span>Moving...</span>
                      </div>
                    )}

                    {/* Checkbox Overlay */}
                    <div className={`file-item-checkbox-wrapper ${selectedItems.length > 0 ? 'has-selection' : ''}`}>
                      <input 
                        type="checkbox" 
                        className="file-checkbox" 
                        checked={isItemChecked}
                        onChange={(e) => handleToggleSelect(e, file)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

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
                    <th className="checkbox-column">
                      <input 
                        type="checkbox" 
                        className="file-checkbox" 
                        checked={filteredFiles.length > 0 && selectedItems.length === filteredFiles.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((file) => {
                    const isItemChecked = selectedItems.some(i => i.sha === file.sha);
                    const isHighlighted = highlightedSha === file.sha || selectedFileSha === file.sha;
                    const ext = file.name.split('.').pop()?.toUpperCase() || '';
                    const displayType = file.type === 'dir' ? 'Folder' : `${ext} File`;
                    return (
                      <tr 
                        key={file.sha} 
                        className={`${isItemChecked ? 'selected' : ''} ${isHighlighted ? 'pulse-highlight' : ''} ${draggedOverPath === file.path ? 'drag-over' : ''}`}
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

                        // Drag and drop Row attributes
                        draggable={file.type === 'file'}
                        onDragStart={file.type === 'file' ? (e) => handleDragStart(e, file) : undefined}
                        onDragOver={file.type === 'dir' ? (e) => handleDragOver(e, file) : undefined}
                        onDragEnter={file.type === 'dir' ? (e) => handleDragEnter(e, file) : undefined}
                        onDragLeave={file.type === 'dir' ? handleDragLeave : undefined}
                        onDrop={file.type === 'dir' ? (e) => handleDrop(e, file) : undefined}
                        style={{ position: 'relative' }}
                      >
                        <td className="checkbox-column">
                          <input 
                            type="checkbox" 
                            className="file-checkbox" 
                            checked={isItemChecked}
                            onChange={(e) => handleToggleSelect(e, file)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {movingItems[file.path] === 'loading' ? (
                              <RefreshCw size={18} className="spin text-muted" />
                            ) : (
                              getListFileIcon(file)
                            )}
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
                      <td colSpan={5} style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
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
