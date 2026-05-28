import React, { useState, useEffect, useRef } from 'react';
import type { GithubFile, GithubRepo, GithubProfile } from '../lib/github';
import { 
  fetchContents, 
  uploadFile, 
  deleteFile, 
  getCdnUrl,
  fileToBase64,
  fetchUserRepos,
  fetchUserProfile
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
  ExternalLink,
  Plus,
  Search,
  BookOpen,
  ArrowLeft,
  User,
  AlertCircle,
  X,
  Check
} from 'lucide-react';
import { AstroBucketLogo } from './AstroBucketLogo';
import type { GithubSession } from '../App';


interface FileExplorerProps {
  session: GithubSession;
  onLogout: () => void;
}

export interface AttachedRepo {
  repo: string;
  branch: string;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ session, onLogout }) => {
  const [attachedRepos, setAttachedRepos] = useState<AttachedRepo[]>([]);
  const [activeRepo, setActiveRepo] = useState<AttachedRepo | null>(null);
  const [profile, setProfile] = useState<GithubProfile | null>(null);

  // File explorer states
  const [currentPath, setCurrentPath] = useState<string>('');
  const [files, setFiles] = useState<GithubFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search filter for files in current folder
  const [fileSearch, setFileSearch] = useState('');

  // Fetching GitHub repositories
  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([]);
  const [fetchingRepos, setFetchingRepos] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  
  // Manual attach form states
  const [manualRepo, setManualRepo] = useState('');
  const [manualBranch, setManualBranch] = useState('main');
  const [manualError, setManualError] = useState('');
  const [attachingManual, setAttachingManual] = useState(false);

  // Copy success notification state
  const [copiedFileUrl, setCopiedFileUrl] = useState<string | null>(null);

  // Load attached repositories and active repository on mount
  useEffect(() => {
    const storedRepos = localStorage.getItem(`astrobucket-attached-repos-${session.owner}`);
    const storedActive = localStorage.getItem(`astrobucket-active-repo-${session.owner}`);
    
    if (storedRepos) {
      try {
        const parsed = JSON.parse(storedRepos);
        setAttachedRepos(parsed);
      } catch (e) {
        console.error('Failed to parse attached repos', e);
      }
    }
    
    if (storedActive) {
      try {
        const parsed = JSON.parse(storedActive);
        setActiveRepo(parsed);
      } catch (e) {
        console.error('Failed to parse active repo', e);
      }
    }
    
    loadUserProfile();
    loadGithubRepos();
  }, [session]);

  const loadUserProfile = async () => {
    try {
      const data = await fetchUserProfile(session.token, session.owner);
      setProfile(data);
    } catch (err) {
      console.error('Failed to fetch user profile', err);
    }
  };

  const loadGithubRepos = async () => {
    setFetchingRepos(true);
    try {
      const data = await fetchUserRepos(session.token, session.owner);
      setGithubRepos(data);
    } catch (err) {
      console.error('Failed to fetch user repos', err);
    } finally {
      setFetchingRepos(false);
    }
  };

  // Whenever activeRepo changes, load files
  useEffect(() => {
    if (activeRepo) {
      loadContents('');
    } else {
      setFiles([]);
      setCurrentPath('');
    }
  }, [activeRepo]);

  const loadContents = async (path: string = currentPath) => {
    if (!activeRepo) return;
    setLoading(true);
    try {
      const creds = {
        token: session.token,
        owner: session.owner,
        repo: activeRepo.repo,
        branch: activeRepo.branch
      };
      const data = await fetchContents(creds, path);
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

  const selectRepo = (repo: AttachedRepo | null) => {
    setActiveRepo(repo);
    if (repo) {
      localStorage.setItem(`astrobucket-active-repo-${session.owner}`, JSON.stringify(repo));
    } else {
      localStorage.removeItem(`astrobucket-active-repo-${session.owner}`);
    }
    setCurrentPath('');
    setFileSearch('');
  };

  const attachRepo = (repoName: string, branchName: string) => {
    const exists = attachedRepos.find(
      r => r.repo.toLowerCase() === repoName.toLowerCase() && r.branch.toLowerCase() === branchName.toLowerCase()
    );
    if (exists) {
      selectRepo(exists);
      return;
    }

    const updated = [...attachedRepos, { repo: repoName, branch: branchName }];
    setAttachedRepos(updated);
    localStorage.setItem(`astrobucket-attached-repos-${session.owner}`, JSON.stringify(updated));
    selectRepo({ repo: repoName, branch: branchName });
  };

  const detachRepo = (e: React.MouseEvent, repoToDetach: AttachedRepo) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to detach "${repoToDetach.repo}" from AstroBucket?`)) {
      const updated = attachedRepos.filter(
        r => !(r.repo === repoToDetach.repo && r.branch === repoToDetach.branch)
      );
      setAttachedRepos(updated);
      localStorage.setItem(`astrobucket-attached-repos-${session.owner}`, JSON.stringify(updated));
      
      if (activeRepo && activeRepo.repo === repoToDetach.repo && activeRepo.branch === repoToDetach.branch) {
        if (updated.length > 0) {
          selectRepo(updated[0]);
        } else {
          selectRepo(null);
        }
      }
    }
  };

  const handleManualAttachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError('');
    if (!manualRepo.trim()) return;

    setAttachingManual(true);
    try {
      const headers = {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${session.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      };
      const response = await fetch(
        `https://api.github.com/repos/${session.owner}/${manualRepo.trim()}`,
        { headers }
      );
      
      if (!response.ok) {
        throw new Error(`Repository "${manualRepo.trim()}" not found or inaccessible under owner "${session.owner}".`);
      }
      
      const repoDetails = await response.json();
      const defaultBranch = manualBranch.trim() || repoDetails.default_branch || 'main';
      
      attachRepo(manualRepo.trim(), defaultBranch);
      setManualRepo('');
      setManualBranch('main');
    } catch (err: any) {
      console.error(err);
      setManualError(err.message || 'Verification failed. Check the repository name.');
    } finally {
      setAttachingManual(false);
    }
  };

  const handleNavigate = (path: string) => {
    loadContents(path);
  };

  const handleBreadcrumbClick = (index: number) => {
    const parts = currentPath.split('/').filter(Boolean);
    const newPath = parts.slice(0, index + 1).join('/');
    loadContents(newPath);
  };

  const handleCopyCdn = (file: GithubFile) => {
    if (!activeRepo) return;
    const url = getCdnUrl(session.owner, activeRepo.repo, activeRepo.branch, file.path);
    navigator.clipboard.writeText(url);
    
    // Set copy success feedback
    setCopiedFileUrl(url);
    setTimeout(() => setCopiedFileUrl(null), 2000);
  };

  const handleDelete = async (file: GithubFile) => {
    if (!activeRepo) return;
    if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
      setLoading(true);
      try {
        const creds = {
          token: session.token,
          owner: session.owner,
          repo: activeRepo.repo,
          branch: activeRepo.branch
        };
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
    if (!activeRepo) return;
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
      
      let sha = undefined;
      const existingFile = files.find(f => f.name === file.name);
      if (existingFile) {
         if (!confirm(`File "${file.name}" already exists. Overwrite?`)) {
           setUploading(false);
           return;
         }
         sha = existingFile.sha;
      }
      
      const creds = {
        token: session.token,
        owner: session.owner,
        repo: activeRepo.repo,
        branch: activeRepo.branch
      };
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
    if (file.type === 'dir') return <Folder size={30} className="file-icon" />;
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
    const codeExts = ['html', 'css', 'js', 'ts', 'jsx', 'tsx', 'json', 'md'];
    
    if (imageExts.includes(ext || '')) return <ImageIcon size={30} className="file-icon" style={{ color: '#60a5fa' }} />;
    if (codeExts.includes(ext || '')) return <Code size={30} className="file-icon" style={{ color: '#a855f7' }} />;
    return <FileIcon size={30} className="file-icon" />;
  };

  const breadcrumbParts = currentPath.split('/').filter(Boolean);

  // Filters
  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(fileSearch.toLowerCase())
  );

  const filteredRepos = githubRepos.filter(r => 
    r.name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  return (
    <div className="dashboard-layout">
      {/* Side Navigation Panel */}
      <aside className="sidebar glass-panel">
        <div className="sidebar-header" onClick={() => selectRepo(null)} style={{ cursor: 'pointer' }}>
          <div className="brand-icon-wrapper" style={{ padding: '0.2rem' }}>
            <AstroBucketLogo size={24} />
          </div>
          <span className="text-gradient font-display" style={{ fontWeight: 700, fontSize: '1.25rem' }}>AstroBucket</span>
        </div>

        {/* User Profile Info */}
        <div className="user-profile">
          <div className="avatar-wrapper">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={session.owner} className="user-avatar" />
            ) : (
              <div className="user-avatar-placeholder">
                <User size={18} />
              </div>
            )}
          </div>
          <div className="user-details-text">
            <span className="user-name">{profile?.name || session.owner}</span>
            <span className="user-role">@{session.owner}</span>
          </div>
        </div>

        {/* Repositories Navigation */}
        <div className="sidebar-nav">
          <div className="nav-section-title">
            <span>ATTACHED REPOSITORIES</span>
            <button className="btn-icon" onClick={() => selectRepo(null)} title="Attach new repository">
              <Plus size={14} />
            </button>
          </div>

          <div className="sidebar-repos-list">
            {attachedRepos.map((r, index) => {
              const isActive = activeRepo?.repo === r.repo && activeRepo?.branch === r.branch;
              return (
                <div 
                  key={index} 
                  className={`repo-item ${isActive ? 'active' : ''}`}
                  onClick={() => selectRepo(r)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <BookOpen size={16} className="repo-icon" />
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span className="repo-name-text">{r.repo}</span>
                      <span className="repo-branch-text">{r.branch}</span>
                    </div>
                  </div>
                  <button 
                    className="repo-detach-btn"
                    onClick={(e) => detachRepo(e, r)}
                    title="Detach Repository"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}

            {attachedRepos.length === 0 && (
              <div className="empty-sidebar-repos">
                No repositories attached.
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="sidebar-footer">
          <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }} onClick={onLogout}>
            <LogOut size={16} /> Disconnect Account
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {activeRepo ? (
          /* Active Repository File Explorer Workspace */
          <div className="workspace-container">
            <header className="workspace-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button className="btn-icon btn-back-dashboard" onClick={() => selectRepo(null)} title="Back to Dashboard">
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {activeRepo.repo}
                    <span className="branch-badge">{activeRepo.branch}</span>
                  </h1>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                    GitHub Bucket CDN
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-outline" onClick={() => loadContents()} disabled={loading || uploading}>
                  <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
                </button>
                <a 
                  href={`https://github.com/${session.owner}/${activeRepo.repo}/tree/${activeRepo.branch}`}
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn btn-outline"
                >
                  <ExternalLink size={16} /> Open GitHub
                </a>
              </div>
            </header>

            {/* Breadcrumbs Navigation */}
            <div className="breadcrumbs">
              <div 
                className={`breadcrumb-item ${breadcrumbParts.length === 0 ? 'breadcrumb-active' : ''}`}
                onClick={() => loadContents('')}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <Home size={14} style={{ marginRight: '4px' }}/> Root
              </div>
              
              {breadcrumbParts.map((part, index) => (
                <React.Fragment key={index}>
                  <ChevronRight size={14} className="breadcrumb-separator" />
                  <div 
                    className={`breadcrumb-item ${index === breadcrumbParts.length - 1 ? 'breadcrumb-active' : ''}`}
                    onClick={() => handleBreadcrumbClick(index)}
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
              />
              <Upload size={40} className={uploading ? 'spin' : ''} style={{ color: uploading ? 'var(--primary)' : 'var(--text-muted)' }} />
              {uploading ? (
                <h3 className="text-primary" style={{ fontSize: '1.1rem' }}>Uploading asset...</h3>
              ) : (
                <div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>Drag & Drop to upload files</h3>
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>or click to select from your machine</p>
                </div>
              )}
            </div>

            {/* File List Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
              <div className="search-bar-wrapper" style={{ flex: 1, maxWidth: '400px' }}>
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
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                {filteredFiles.length} item{filteredFiles.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* File Listing Container */}
            {loading && !uploading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem' }}>
                <RefreshCw size={28} className="spin text-muted" />
              </div>
            ) : (
              <div className="file-grid">
                {filteredFiles.map((file) => (
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
                            <Copy size={15} />
                          </button>
                          <a 
                            href={file.html_url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="btn-icon"
                            title="View on GitHub"
                          >
                            <ExternalLink size={15} />
                          </a>
                          <button 
                            className="btn-icon" 
                            style={{ color: 'var(--danger)' }} 
                            onClick={() => handleDelete(file)}
                            title="Delete File"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {filteredFiles.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
                    No files or directories found.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Welcome & Attach Repositories Dashboard Screen */
          <div className="dashboard-welcome-container">
            <div className="welcome-banner glass-panel">
              <span className="badge" style={{ marginBottom: '0.75rem' }}>AstroBucket Console</span>
              <h1 className="text-gradient-hero" style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>
                Storage Dashboard
              </h1>
              <p className="text-muted" style={{ maxWidth: '600px', fontSize: '1rem', lineHeight: '1.5' }}>
                Connect your GitHub repositories to convert them into S3-like storage buckets with free, global jsDelivr edge CDN link sharing.
              </p>
            </div>

            {/* Connected Repos Grid */}
            {attachedRepos.length > 0 && (
              <div style={{ marginBottom: '2.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-main)', fontWeight: 600 }}>
                  Active Buckets
                </h2>
                <div className="repo-grid">
                  {attachedRepos.map((r, idx) => (
                    <div 
                      key={idx} 
                      className="repo-card glass-card"
                      onClick={() => selectRepo(r)}
                    >
                      <div className="repo-card-header">
                        <BookOpen size={22} className="repo-card-icon" />
                        <span className="repo-card-badge">{r.branch}</span>
                      </div>
                      <h3 className="repo-card-title">{r.repo}</h3>
                      <p className="repo-card-desc">
                        https://cdn.jsdelivr.net/gh/{session.owner}/{r.repo}@{r.branch}/...
                      </p>
                      <div className="repo-card-actions">
                        <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                          Explore Files
                        </button>
                        <button 
                          className="btn-icon" 
                          style={{ color: 'var(--danger)' }} 
                          onClick={(e) => detachRepo(e, r)}
                          title="Detach Repository"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attach Repository Options Layout */}
            <div className="attach-sections-layout">
              {/* Fetch Repos from GitHub */}
              <div className="attach-source-section glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Select Repository</h2>
                  <button 
                    className="btn-icon" 
                    onClick={loadGithubRepos} 
                    disabled={fetchingRepos} 
                    title="Refresh Repositories"
                  >
                    <RefreshCw size={14} className={fetchingRepos ? 'spin' : ''} />
                  </button>
                </div>

                <div className="search-bar-wrapper" style={{ marginBottom: '1rem' }}>
                  <Search size={16} className="search-bar-icon" />
                  <input 
                    type="text" 
                    className="input-field search-bar-input" 
                    placeholder="Search your repos..." 
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                  />
                </div>

                <div className="github-repos-list-container">
                  {fetchingRepos ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                      <RefreshCw size={24} className="spin text-muted" />
                    </div>
                  ) : filteredRepos.length > 0 ? (
                    <div className="github-repos-scroll-list">
                      {filteredRepos.map((repo) => {
                        const isAttached = attachedRepos.some(r => r.repo.toLowerCase() === repo.name.toLowerCase());
                        return (
                          <div key={repo.id} className="github-repo-list-item">
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <span className="github-repo-item-name">{repo.name}</span>
                                {repo.private && <span className="private-tag">Private</span>}
                              </div>
                              <span className="github-repo-item-desc">
                                {repo.description || 'No description provided.'}
                              </span>
                            </div>
                            <button 
                              className={`btn ${isAttached ? 'btn-outline' : 'btn-primary'}`}
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                              onClick={() => attachRepo(repo.name, repo.default_branch)}
                            >
                              {isAttached ? 'Connected' : 'Attach'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-repos-placeholder">
                      No repositories found. Make sure owner name is correct.
                    </div>
                  )}
                </div>
              </div>

              {/* Manual Connection Form */}
              <div className="attach-source-section glass-panel">
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.25rem' }}>Manual Attach</h2>
                
                {manualError && (
                  <div className="error-banner" style={{ marginBottom: '1rem' }}>
                    <AlertCircle size={16} />
                    <span>{manualError}</span>
                  </div>
                )}

                <form onSubmit={handleManualAttachSubmit}>
                  <div className="input-group">
                    <label className="input-label">Repository Name</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. my-assets-bucket" 
                      value={manualRepo}
                      onChange={(e) => setManualRepo(e.target.value)}
                      required
                      disabled={attachingManual}
                    />
                  </div>

                  <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="input-label">Branch (Optional)</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. main" 
                      value={manualBranch}
                      onChange={(e) => setManualBranch(e.target.value)}
                      disabled={attachingManual}
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ width: '100%', justifyContent: 'center' }}
                    disabled={attachingManual}
                  >
                    <Plus size={16} /> {attachingManual ? 'Attaching...' : 'Attach Repository'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Glowing Toast Notification on Copy success */}
      {copiedFileUrl && (
        <div className="toast-container">
          <div className="toast success">
            <Check size={18} style={{ color: '#10b981' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <strong style={{ fontSize: '0.85rem', color: '#fff' }}>Link Copied!</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {copiedFileUrl}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
