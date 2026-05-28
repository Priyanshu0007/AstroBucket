import React, { useState, useEffect, useRef } from 'react';
import type { 
  GithubCredentials, 
  GithubFile 
} from '../lib/github';
import { 
  fetchContents, 
  uploadFile, 
  deleteFile, 
  getCdnUrl,
  fileToBase64 
} from '../lib/github';
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
  LogOut,
  ExternalLink
} from 'lucide-react';
import { AstroBucketLogo } from './AstroBucketLogo';
interface FileExplorerProps {
  creds: GithubCredentials;
  onLogout: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ creds, onLogout }) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [files, setFiles] = useState<GithubFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadContents = async (path: string = currentPath) => {
    setLoading(true);
    try {
      const data = await fetchContents(creds, path);
      // Sort directories first, then alphabetically
      data.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'dir' ? -1 : 1;
      });
      setFiles(data);
      setCurrentPath(path);
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes('Resource not accessible')) {
        alert('GitHub Token Error: Your Personal Access Token does not have read access. Please ensure your token has "Contents: Read and write" repository permissions.');
      } else {
        alert('Failed to load repository contents. Please check your credentials and repository details.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContents('');
  }, []);

  const handleNavigate = (path: string) => {
    loadContents(path);
  };

  const handleBreadcrumbClick = (index: number) => {
    const parts = currentPath.split('/').filter(Boolean);
    const newPath = parts.slice(0, index + 1).join('/');
    loadContents(newPath);
  };

  const handleCopyCdn = (file: GithubFile) => {
    const url = getCdnUrl(creds.owner, creds.repo, creds.branch, file.path);
    navigator.clipboard.writeText(url);
    // Simple toast
    alert('CDN URL copied to clipboard: ' + url);
  };

  const handleDelete = async (file: GithubFile) => {
    if (confirm(`Are you sure you want to delete ${file.name}?`)) {
      setLoading(true);
      try {
        await deleteFile(creds, file.path, file.sha);
        await loadContents();
      } catch (err: any) {
        console.error(err);
        if (err?.message?.includes('Resource not accessible')) {
          alert('GitHub Token Error: Your Personal Access Token does not have write access. Please ensure your token has "Contents: Read and write" repository permissions.');
        } else {
          alert(`Failed to delete file: ${err.message || 'Unknown error'}`);
        }
        setLoading(false);
      }
    }
  };

  const processFile = async (file: File) => {
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
      
      // Check if file exists to get SHA (for overwrite)
      let sha = undefined;
      const existingFile = files.find(f => f.name === file.name);
      if (existingFile) {
         if (!confirm(`File ${file.name} already exists. Overwrite?`)) {
           setUploading(false);
           return;
         }
         sha = existingFile.sha;
      }
      
      await uploadFile(creds, filePath, base64, `Upload ${file.name}`, sha);
      await loadContents();
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes('Resource not accessible')) {
        alert('GitHub Token Error: Your Personal Access Token does not have write access. Please ensure your token has "Contents: Read and write" repository permissions.');
      } else {
        alert(`Failed to upload file: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const getFileIcon = (file: GithubFile) => {
    if (file.type === 'dir') return <Folder size={32} className="file-icon" />;
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
    const codeExts = ['html', 'css', 'js', 'ts', 'jsx', 'tsx', 'json', 'md'];
    
    if (imageExts.includes(ext || '')) return <ImageIcon size={32} className="file-icon" />;
    if (codeExts.includes(ext || '')) return <Code size={32} className="file-icon" />;
    return <FileIcon size={32} className="file-icon" />;
  };

  const breadcrumbParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="container">
      <header className="app-header">
        <div className="app-title">
          <AstroBucketLogo size={28} />
          <span className="text-gradient">AstroBucket</span>
          <span className="text-muted" style={{ fontSize: '1rem', marginLeft: '1rem' }}>
            {creds.owner} / {creds.repo}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-outline" onClick={() => loadContents()} disabled={loading || uploading}>
            <RefreshCw size={18} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn btn-outline" onClick={onLogout}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </header>

      <div className="breadcrumbs">
        <div 
          className={`breadcrumb-item ${breadcrumbParts.length === 0 ? 'breadcrumb-active' : ''}`}
          onClick={() => loadContents('')}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <Home size={16} style={{ marginRight: '4px' }}/> Root
        </div>
        
        {breadcrumbParts.map((part, index) => (
          <React.Fragment key={index}>
            <ChevronRight size={16} className="breadcrumb-separator" />
            <div 
              className={`breadcrumb-item ${index === breadcrumbParts.length - 1 ? 'breadcrumb-active' : ''}`}
              onClick={() => handleBreadcrumbClick(index)}
            >
              {part}
            </div>
          </React.Fragment>
        ))}
      </div>

      <div 
        className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
        style={{ marginBottom: '2rem' }}
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
        />
        <Upload size={48} className={uploading ? 'spin' : ''} style={{ color: uploading ? 'var(--primary)' : 'var(--text-muted)' }} />
        {uploading ? (
          <h3 className="text-primary">Uploading...</h3>
        ) : (
          <div>
            <h3>Drop file to upload</h3>
            <p className="text-muted">or click to select from your computer</p>
          </div>
        )}
      </div>

      {loading && !uploading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <RefreshCw size={32} className="spin text-muted" />
        </div>
      ) : (
        <div className="file-grid">
          {files.map((file) => (
            <div className="file-item glass-card" key={file.sha}>
              {file.type === 'dir' ? (
                <div 
                  style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}
                  onClick={() => handleNavigate(file.path)}
                >
                  {getFileIcon(file)}
                  <div className="file-name" style={{ marginTop: '0.5rem' }}>{file.name}</div>
                </div>
              ) : (
                <>
                  {getFileIcon(file)}
                  <div className="file-name">{file.name}</div>
                  <div className="file-actions">
                    <button 
                      className="btn-icon" 
                      onClick={() => handleCopyCdn(file)}
                      title="Copy CDN Link"
                    >
                      <Copy size={16} />
                    </button>
                    <a 
                      href={file.html_url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="btn-icon"
                      title="View on GitHub"
                    >
                      <ExternalLink size={16} />
                    </a>
                    <button 
                      className="btn-icon" 
                      style={{ color: 'var(--danger)' }} 
                      onClick={() => handleDelete(file)}
                      title="Delete File"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {files.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No files found in this directory.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
