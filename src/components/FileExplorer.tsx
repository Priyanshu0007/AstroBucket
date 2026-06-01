import React, { useState, useEffect } from 'react';
import type { GithubFile } from '../api/types';
import { getCdnUrl, fetchFileRaw } from '../api/client';
import JSZip from 'jszip';
import {
  useUserProfile,
  useUserRepos,
  useRepoContents,
  useRepoTree,
  useUploadFile,
  useDeleteFile
} from '../api/hooks';
import { RefreshCw } from 'lucide-react';
import { FilePreviewModal } from './FilePreviewModal';
import type { GithubSession } from '../App';

// Import Types
import type { AttachedRepo } from './FileExplorer/types';
export type { AttachedRepo } from './FileExplorer/types';

// Import Modular Components
import { Sidebar } from './FileExplorer/Sidebar';
import { WelcomeDashboard } from './FileExplorer/WelcomeDashboard';
import { ExplorerView } from './FileExplorer/ExplorerView';
import { AnalyticsView } from './FileExplorer/AnalyticsView';
import { UploadProgressPanel } from './FileExplorer/UploadProgressPanel';
import { ToastNotification } from './FileExplorer/ToastNotification';
import { useBatchUpload } from './FileExplorer/useBatchUpload';

// Import Stylesheet
import '../styles/explorer.css';

interface FileExplorerProps {
  session: GithubSession;
  onLogout: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ session, onLogout }) => {
  const [attachedRepos, setAttachedRepos] = useState<AttachedRepo[]>([]);
  const [activeRepo, setActiveRepo] = useState<AttachedRepo | null>(null);

  // File explorer states
  const [currentPath, setCurrentPath] = useState<string>('');
  const [localActionLoading, setLocalActionLoading] = useState<boolean>(false);

  // Selection & Modal states
  const [selectedFileSha, setSelectedFileSha] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<GithubFile | null>(null);

  // Copy success notification state
  const [copiedFileUrl, setCopiedFileUrl] = useState<string | null>(null);

  // Batch Progress state
  const [batchProgress, setBatchProgress] = useState<{
    isOpen: boolean;
    title: string;
    current: number;
    total: number;
    status: string;
  } | null>(null);

  // Analytics Dashboard states
  const [activeTab, setActiveTab] = useState<'explorer' | 'analytics'>('explorer');

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
  }, [session]);

  // TanStack Query Hooks
  const { data: profile } = useUserProfile(session.token, session.owner);
  const { 
    data: githubRepos = [], 
    isFetching: fetchingRepos, 
    refetch: refetchGithubRepos 
  } = useUserRepos(session.token, session.owner);

  const { 
    data: rawFiles = [], 
    isFetching: loadingContents, 
    refetch: refetchContents 
  } = useRepoContents(
    session.token,
    session.owner,
    activeRepo?.repo,
    activeRepo?.branch,
    currentPath
  );

  const { 
    data: repoTree = [], 
    isFetching: loadingTree, 
    error: treeErrorObj, 
    refetch: refetchRepoTree 
  } = useRepoTree(
    session.token,
    session.owner,
    activeRepo?.repo,
    activeRepo?.branch
  );

  const treeError = treeErrorObj ? (treeErrorObj as Error).message || 'Failed to scan repository files recursively.' : null;

  // Mutation hooks
  const uploadMutation = useUploadFile();
  const deleteMutation = useDeleteFile();

  const loading = loadingContents || localActionLoading;

  const files = React.useMemo(() => {
    return [...rawFiles].sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'dir' ? -1 : 1;
    });
  }, [rawFiles]);

  // Whenever activeRepo changes, reset path/tab
  useEffect(() => {
    if (!activeRepo) {
      setCurrentPath('');
    }
    setSelectedFileSha(null);
    setActiveTab('explorer');
  }, [activeRepo]);

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
    setLocalActionLoading(true);
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
        
      await uploadMutation.mutateAsync({
        creds,
        path: folderPath,
        contentBase64: '',
        message: `Create folder ${folderName}`
      });
    } catch (err: any) {
      console.error(err);
      alert(`Failed to create folder: ${err.message || 'Unknown error'}`);
    } finally {
      setLocalActionLoading(false);
    }
  };

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
  };

  const handleBreadcrumbClick = (index: number) => {
    const parts = currentPath.split('/').filter(Boolean);
    const newPath = parts.slice(0, index + 1).join('/');
    setCurrentPath(newPath);
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
      setLocalActionLoading(true);
      try {
        const creds = {
          token: session.token,
          owner: session.owner,
          repo: activeRepo.repo,
          branch: activeRepo.branch
        };
        await deleteMutation.mutateAsync({
          creds,
          path: file.path,
          sha: file.sha,
          message: `Delete via AstroBucket`
        });
      } catch (err: any) {
        console.error(err);
        if (err?.response?.data?.message?.includes('Resource not accessible')) {
          alert('GitHub Token Error: Your Personal Access Token does not have write access. Please ensure your token has "Contents: Read and write" repository permissions.');
        } else {
          alert(`Failed to delete file: ${err.message || 'Unknown error'}`);
        }
      } finally {
        setLocalActionLoading(false);
      }
    }
  };

  const handleAnalyticsDeleteFile = async (path: string, sha: string) => {
    if (!activeRepo) return;
    setLocalActionLoading(true);
    try {
      const creds = {
        token: session.token,
        owner: session.owner,
        repo: activeRepo.repo,
        branch: activeRepo.branch
      };
      await deleteMutation.mutateAsync({
        creds,
        path,
        sha,
        message: `Delete via AstroBucket`
      });
    } catch (err: any) {
      console.error(err);
      alert(`Failed to delete file: ${err.message || 'Unknown error'}`);
    } finally {
      setLocalActionLoading(false);
    }
  };

  const handleLocateFile = (filePath: string, sha: string) => {
    const parts = filePath.split('/');
    parts.pop(); // Remove file name
    const folderPath = parts.join('/');
    setCurrentPath(folderPath);
    setSelectedFileSha(sha);
    setActiveTab('explorer');
  };

  // Hook for batch uploads
  const {
    uploadQueue,
    showProgressPanel,
    setShowProgressPanel,
    isPanelMinimized,
    setIsPanelMinimized,
    elapsedTime,
    uploading,
    startBatchUpload
  } = useBatchUpload({
    session,
    activeRepo,
    currentPath,
    refetchContents,
    refetchRepoTree
  });

  // Batch operations handlers
  const handleBatchDelete = async (items: GithubFile[]) => {
    if (!activeRepo) return;
    const itemLabel = items.length === 1 ? 'item' : 'items';
    if (!confirm(`Are you sure you want to delete the ${items.length} selected ${itemLabel}?`)) return;

    // Resolve directories to flat files list
    const filesToDelete: { path: string; sha: string }[] = [];
    for (const item of items) {
      if (item.type === 'file') {
        filesToDelete.push({ path: item.path, sha: item.sha });
      } else {
        const prefix = item.path.endsWith('/') ? item.path : `${item.path}/`;
        const nested = repoTree.filter(t => t.type === 'blob' && t.path.startsWith(prefix));
        for (const file of nested) {
          filesToDelete.push({ path: file.path, sha: file.sha });
        }
      }
    }

    if (filesToDelete.length === 0) {
      alert('No files found to delete.');
      return;
    }

    setBatchProgress({
      isOpen: true,
      title: 'Deleting Files',
      current: 0,
      total: filesToDelete.length,
      status: 'Initializing batch deletion...'
    });

    const creds = {
      token: session.token,
      owner: session.owner,
      repo: activeRepo.repo,
      branch: activeRepo.branch
    };

    const limit = 3;
    let currentIndex = 0;
    let completed = 0;

    const runNext = async (): Promise<void> => {
      if (currentIndex >= filesToDelete.length) return;
      const taskIndex = currentIndex++;
      const file = filesToDelete[taskIndex];

      try {
        setBatchProgress(prev => prev ? {
          ...prev,
          status: `Deleting: ${file.path.split('/').pop()}`
        } : null);

        await deleteMutation.mutateAsync({
          creds,
          path: file.path,
          sha: file.sha,
          message: 'Batch delete via AstroBucket'
        });
      } catch (err) {
        console.error(`Failed to delete ${file.path}:`, err);
      } finally {
        completed++;
        setBatchProgress(prev => prev ? {
          ...prev,
          current: completed
        } : null);
        await runNext();
      }
    };

    const workers = Array(Math.min(limit, filesToDelete.length))
      .fill(null)
      .map(() => runNext());
    
    await Promise.all(workers);

    setBatchProgress(null);
    refetchContents();
    refetchRepoTree();
  };

  const handleBatchDownload = async (items: GithubFile[]) => {
    if (!activeRepo) return;

    // Resolve directories to flat files list
    const filesToDownload: string[] = [];
    for (const item of items) {
      if (item.type === 'file') {
        filesToDownload.push(item.path);
      } else {
        const prefix = item.path.endsWith('/') ? item.path : `${item.path}/`;
        const nested = repoTree.filter(t => t.type === 'blob' && t.path.startsWith(prefix));
        for (const file of nested) {
          filesToDownload.push(file.path);
        }
      }
    }

    if (filesToDownload.length === 0) {
      alert('No files found to download.');
      return;
    }

    setBatchProgress({
      isOpen: true,
      title: 'Downloading Files',
      current: 0,
      total: filesToDownload.length,
      status: 'Preparing ZIP bundle...'
    });

    const creds = {
      token: session.token,
      owner: session.owner,
      repo: activeRepo.repo,
      branch: activeRepo.branch
    };

    const zip = new JSZip();
    const limit = 4;
    let currentIndex = 0;
    let completed = 0;

    const runNextDownload = async (): Promise<void> => {
      if (currentIndex >= filesToDownload.length) return;
      const taskIndex = currentIndex++;
      const path = filesToDownload[taskIndex];

      try {
        setBatchProgress(prev => prev ? {
          ...prev,
          status: `Downloading: ${path.split('/').pop()}`
        } : null);

        const blob = await fetchFileRaw(creds, path);

        // Determine zip relative path
        let zipPath = path;
        if (currentPath) {
          const prefix = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
          if (path.startsWith(prefix)) {
            zipPath = path.substring(prefix.length);
          }
        }

        zip.file(zipPath, blob);
      } catch (err) {
        console.error(`Failed to download ${path}:`, err);
      } finally {
        completed++;
        setBatchProgress(prev => prev ? {
          ...prev,
          current: completed
        } : null);
        await runNextDownload();
      }
    };

    const workers = Array(Math.min(limit, filesToDownload.length))
      .fill(null)
      .map(() => runNextDownload());

    await Promise.all(workers);

    setBatchProgress(prev => prev ? {
      ...prev,
      status: 'Generating ZIP archive...'
    } : null);

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeRepo.repo}-archive.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate zip:', err);
      alert('Failed to bundle files into a ZIP.');
    } finally {
      setBatchProgress(null);
    }
  };

  const activeRepoDetails = githubRepos.find(r => r.name.toLowerCase() === activeRepo?.repo.toLowerCase());
  const isPrivate = activeRepoDetails ? activeRepoDetails.private : false;

  return (
    <div className="dashboard-layout">
      {/* Side Navigation Panel */}
      <Sidebar 
        session={session}
        profile={profile || null}
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
                  <RefreshCw size={18} style={{ transform: 'rotate(-90deg)' }} />
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
                <button className="btn btn-outline" onClick={() => { refetchContents(); refetchRepoTree(); }} disabled={loading || uploading}>
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
                repoTree={repoTree}
                onBatchDelete={handleBatchDelete}
                onBatchDownload={handleBatchDownload}
                onRefresh={() => {
                  refetchContents();
                  refetchRepoTree();
                }}
              />
            ) : (
              <AnalyticsView 
                session={session}
                activeRepo={activeRepo}
                repoTree={repoTree}
                loadingTree={loadingTree}
                treeError={treeError}
                loadRepoTree={() => refetchRepoTree()}
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
            loadGithubRepos={refetchGithubRepos}
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
            refetchContents();
            refetchRepoTree();
          }}
        />
      )}

      {/* Glowing Toast Notification on Copy success */}
      <ToastNotification copiedFileUrl={copiedFileUrl} />

      {/* Batch Operations Progress Modal */}
      {batchProgress && batchProgress.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-card progress-modal">
            <header className="progress-header" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{batchProgress.title}</h2>
            </header>
            <div className="progress-body">
              <div className="overall-progress-info" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="overall-stats-text" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span className="text-muted" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                    {batchProgress.status}
                  </span>
                  <span className="text-gradient" style={{ fontWeight: 600 }}>
                    {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                  </span>
                </div>
                <div className="progress-bar-container" style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), #a855f7)', borderRadius: '4px', transition: 'width 0.2s ease' }}
                  />
                </div>
                <span className="text-muted" style={{ fontSize: '0.75rem', textAlign: 'right', marginTop: '0.25rem' }}>
                  Processed {batchProgress.current} of {batchProgress.total} items
                </span>
              </div>
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
