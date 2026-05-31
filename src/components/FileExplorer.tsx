import React, { useState, useEffect } from 'react';
import type { GithubFile } from '../api/types';
import { getCdnUrl } from '../api/client';
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
