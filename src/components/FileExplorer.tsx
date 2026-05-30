import React, { useState, useEffect } from 'react';
import type { GithubFile, GithubRepo, GithubProfile, GithubTreeItem } from '../lib/github';
import { 
  fetchContents, 
  uploadFile, 
  deleteFile, 
  getCdnUrl,
  fileToBase64,
  fetchUserRepos,
  fetchUserProfile,
  fetchRepoTree
} from '../lib/github';
import { Check, RefreshCw } from 'lucide-react';
import { FilePreviewModal } from './FilePreviewModal';
import type { GithubSession } from '../App';

// Import Types
import type { AttachedRepo, UploadQueueItem } from './FileExplorer/types';
export type { AttachedRepo } from './FileExplorer/types';

// Import Modular Components
import { Sidebar } from './FileExplorer/Sidebar';
import { WelcomeDashboard } from './FileExplorer/WelcomeDashboard';
import { ExplorerView } from './FileExplorer/ExplorerView';
import { AnalyticsView } from './FileExplorer/AnalyticsView';
import { UploadProgressPanel } from './FileExplorer/UploadProgressPanel';

// Import Stylesheet
import '../styles/explorer.css';

interface FileExplorerProps {
  session: GithubSession;
  onLogout: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ session, onLogout }) => {
  const [attachedRepos, setAttachedRepos] = useState<AttachedRepo[]>([]);
  const [activeRepo, setActiveRepo] = useState<AttachedRepo | null>(null);
  const [profile, setProfile] = useState<GithubProfile | null>(null);

  // File explorer states
  const [currentPath, setCurrentPath] = useState<string>('');
  const [files, setFiles] = useState<GithubFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [uploading, setUploading] = useState(false);

  // Batch upload states
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [showProgressPanel, setShowProgressPanel] = useState<boolean>(false);
  const [isPanelMinimized, setIsPanelMinimized] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // Selection & Modal states
  const [selectedFileSha, setSelectedFileSha] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<GithubFile | null>(null);

  // Fetching GitHub repositories
  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([]);
  const [fetchingRepos, setFetchingRepos] = useState(false);

  // Copy success notification state
  const [copiedFileUrl, setCopiedFileUrl] = useState<string | null>(null);

  // Analytics Dashboard states
  const [activeTab, setActiveTab] = useState<'explorer' | 'analytics'>('explorer');
  const [repoTree, setRepoTree] = useState<GithubTreeItem[]>([]);
  const [loadingTree, setLoadingTree] = useState<boolean>(false);
  const [treeError, setTreeError] = useState<string | null>(null);

  // Elapsed time tracker for speed calculations
  useEffect(() => {
    let timer: any;
    const isUploading = uploadQueue.some(item => item.status === 'uploading');
    if (isUploading) {
      timer = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [uploadQueue]);

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

  const loadRepoTree = async (targetRepo: AttachedRepo | null = activeRepo) => {
    if (!targetRepo) return;
    setLoadingTree(true);
    setTreeError(null);
    try {
      const creds = {
        token: session.token,
        owner: session.owner,
        repo: targetRepo.repo,
        branch: targetRepo.branch
      };
      const tree = await fetchRepoTree(creds);
      setRepoTree(tree);
    } catch (err: any) {
      console.error('Failed to load repository tree:', err);
      setTreeError(err.message || 'Failed to scan repository files recursively.');
    } finally {
      setLoadingTree(false);
    }
  };

  // Whenever activeRepo changes, load files
  useEffect(() => {
    if (activeRepo) {
      loadContents('');
      loadRepoTree(activeRepo);
    } else {
      setFiles([]);
      setCurrentPath('');
      setRepoTree([]);
    }
    setSelectedFileSha(null);
    setActiveTab('explorer');
    setTreeError(null);
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
      setSelectedFileSha(null);
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

  const handleCreateFolder = async (folderName: string) => {
    if (!activeRepo) return;
    setLoading(true);
    try {
      const creds = {
        token: session.token,
        owner: session.owner,
        repo: activeRepo.repo,
        branch: activeRepo.branch
      };
      
      const folderPath = currentPath 
        ? `${currentPath}/${folderName}/.gitkeep` 
        : `${folderName}/.gitkeep`;
        
      await uploadFile(creds, folderPath, "", `Create folder ${folderName}`);
      await loadContents();
      loadRepoTree();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to create folder: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
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
        loadRepoTree();
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

  // Helper delete file specifically for Analytics View
  const handleAnalyticsDeleteFile = async (path: string, sha: string) => {
    if (!activeRepo) return;
    setLoadingTree(true);
    try {
      const creds = {
        token: session.token,
        owner: session.owner,
        repo: activeRepo.repo,
        branch: activeRepo.branch
      };
      await deleteFile(creds, path, sha);
      await loadContents();
      await loadRepoTree();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to delete file: ${err.message || 'Unknown error'}`);
      setLoadingTree(false);
    }
  };

  const handleLocateFile = (filePath: string, sha: string) => {
    const parts = filePath.split('/');
    parts.pop(); // Remove file name
    const folderPath = parts.join('/');
    setCurrentPath(folderPath);
    setSelectedFileSha(sha);
    setActiveTab('explorer');
    loadContents(folderPath);
  };

  const startBatchUpload = async (filesToUpload: { file: File; relativePath: string }[]) => {
    if (!activeRepo) return;
    
    setElapsedTime(0);
    setUploading(true);
    setShowProgressPanel(true);
    setIsPanelMinimized(false);

    const newItems: UploadQueueItem[] = filesToUpload.map(item => ({
      id: Math.random().toString(36).substring(2, 9),
      name: item.file.name,
      relativePath: item.relativePath,
      size: item.file.size,
      progress: 0,
      status: 'pending',
      file: item.file
    }));
    
    setUploadQueue(newItems);
    
    const creds = {
      token: session.token,
      owner: session.owner,
      repo: activeRepo.repo,
      branch: activeRepo.branch
    };
    
    let shaMap: Record<string, string> = {};
    try {
      const tree = await fetchRepoTree(creds);
      tree.forEach(node => {
        if (node.type === 'blob') {
          shaMap[node.path] = node.sha;
        }
      });
    } catch (err) {
      console.error('Error fetching tree, proceeding without SHA map:', err);
    }

    const updateItemStatus = (id: string, updates: Partial<UploadQueueItem>) => {
      setUploadQueue(prev => prev.map(item => {
        if (item.id === id) {
          return { ...item, ...updates };
        }
        return item;
      }));
    };

    const maxConcurrency = 3;
    let activeIndex = 0;

    const uploadSingleFile = async (item: UploadQueueItem) => {
      const finalPath = currentPath 
        ? `${currentPath}/${item.relativePath}` 
        : item.relativePath;
        
      updateItemStatus(item.id, { status: 'uploading', startTime: Date.now() });
      
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.min(5, (90 - progress) / 5);
        updateItemStatus(item.id, { progress: Math.floor(progress) });
      }, 150);

      try {
        const base64 = await fileToBase64(item.file);
        const sha = shaMap[finalPath];
        
        await uploadFile(creds, finalPath, base64, `Upload ${item.name}`, sha);
        
        clearInterval(progressInterval);
        updateItemStatus(item.id, { 
          status: 'completed', 
          progress: 100, 
          uploadedBytes: item.size 
        });
      } catch (err: any) {
        clearInterval(progressInterval);
        console.error(`Failed to upload ${item.name}:`, err);
        updateItemStatus(item.id, { 
          status: 'failed', 
          progress: 0, 
          error: err.message || 'Upload failed' 
        });
      }
    };

    const worker = async () => {
      while (activeIndex < newItems.length) {
        const index = activeIndex++;
        if (index >= newItems.length) break;
        await uploadSingleFile(newItems[index]);
      }
    };

    const workers = [];
    for (let i = 0; i < Math.min(maxConcurrency, newItems.length); i++) {
      workers.push(worker());
    }
    
    await Promise.all(workers);
    
    setUploading(false);
    await loadContents();
    loadRepoTree();
  };

  const activeRepoDetails = githubRepos.find(r => r.name.toLowerCase() === activeRepo?.repo.toLowerCase());
  const isPrivate = activeRepoDetails ? activeRepoDetails.private : false;

  return (
    <div className="dashboard-layout">
      {/* Side Navigation Panel */}
      <Sidebar 
        session={session}
        profile={profile}
        attachedRepos={attachedRepos}
        activeRepo={activeRepo}
        selectRepo={selectRepo}
        detachRepo={detachRepo}
        onLogout={onLogout}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {activeRepo ? (
          /* Active Repository File Explorer Workspace */
          <div className="workspace-container">
            <header className="workspace-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button className="btn-icon btn-back-dashboard" onClick={() => selectRepo(null)} title="Back to Dashboard">
                  <RefreshCw size={18} style={{ transform: 'rotate(-90deg)' }} /> {/* Using a custom back icon indicator */}
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
                <button className="btn btn-outline" onClick={() => { loadContents(); loadRepoTree(); }} disabled={loading || uploading}>
                  <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
                </button>
                <a 
                  href={`https://github.com/${session.owner}/${activeRepo.repo}/tree/${activeRepo.branch}`}
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn btn-outline"
                >
                  <RefreshCw size={16} /> Open GitHub
                </a>
              </div>
            </header>

            {/* Workspace tabs */}
            <div className="workspace-tabs-container glass-panel">
              <button 
                className={`workspace-tab ${activeTab === 'explorer' ? 'active' : ''}`}
                onClick={() => setActiveTab('explorer')}
              >
                <span>Bucket Explorer</span>
              </button>
              <button 
                className={`workspace-tab ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('analytics')}
              >
                <span>Storage Analytics</span>
              </button>
            </div>

            {activeTab === 'explorer' ? (
              <ExplorerView 
                session={session}
                activeRepo={activeRepo}
                files={files}
                loading={loading}
                uploading={uploading}
                currentPath={currentPath}
                selectedFileSha={selectedFileSha}
                setSelectedFileSha={setSelectedFileSha}
                onNavigate={handleNavigate}
                onBreadcrumbClick={handleBreadcrumbClick}
                onUpload={startBatchUpload}
                onCopyCdn={handleCopyCdn}
                onDelete={handleDelete}
                onPreviewFile={(file) => setPreviewFile(file)}
                onCreateFolder={handleCreateFolder}
              />
            ) : (
              <AnalyticsView 
                session={session}
                activeRepo={activeRepo}
                repoTree={repoTree}
                loadingTree={loadingTree}
                treeError={treeError}
                loadRepoTree={loadRepoTree}
                isPrivate={isPrivate}
                onLocateFile={handleLocateFile}
                onCopyTreeCdn={(url) => {
                  navigator.clipboard.writeText(url);
                  setCopiedFileUrl(url);
                  setTimeout(() => setCopiedFileUrl(null), 2000);
                }}
                onDeleteTreeFile={handleAnalyticsDeleteFile}
              />
            )}
          </div>
        ) : (
          /* Welcome & Attach Repositories Dashboard Screen */
          <WelcomeDashboard 
            session={session}
            attachedRepos={attachedRepos}
            githubRepos={githubRepos}
            fetchingRepos={fetchingRepos}
            loadGithubRepos={loadGithubRepos}
            attachRepo={attachRepo}
            detachRepo={detachRepo}
            selectRepo={selectRepo}
          />
        )}
      </main>

      {/* Media Carousel Preview Modal */}
      {previewFile && activeRepo && (
        <FilePreviewModal 
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          file={previewFile}
          files={files}
          onNavigateToFile={(file) => setPreviewFile(file)}
          session={session}
          activeRepo={activeRepo}
          onFileModified={() => {
            loadContents();
            loadRepoTree();
          }}
        />
      )}

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

      {/* Upload Progress Panel */}
      <UploadProgressPanel 
        uploadQueue={uploadQueue}
        showProgressPanel={showProgressPanel}
        setShowProgressPanel={setShowProgressPanel}
        isPanelMinimized={isPanelMinimized}
        setIsPanelMinimized={setIsPanelMinimized}
        elapsedTime={elapsedTime}
      />
    </div>
  );
};
