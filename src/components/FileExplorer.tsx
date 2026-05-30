import React, { useState, useEffect, useRef } from 'react';
import type { GithubFile, GithubRepo, GithubProfile, GithubTreeItem } from '../lib/github';
import { 
  fetchContents, 
  uploadFile, 
  deleteFile, 
  getCdnUrl,
  fileToBase64,
  fetchUserRepos,
  fetchUserProfile,
  fetchFileRaw,
  fetchRepoTree
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
  Check,
  Eye,
  Grid,
  List,
  FileText,
  Video,
  Music,
  Play,
  Pause,
  Minimize2,
  Maximize2,
  BarChart2,
  HardDrive,
  Database,
  Lock,
  Unlock
} from 'lucide-react';
import { AstroBucketLogo } from './AstroBucketLogo';
import { FilePreviewModal } from './FilePreviewModal';
import type { GithubSession } from '../App';

interface UploadQueueItem {
  id: string;
  name: string;
  relativePath: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
  file: File;
  uploadedBytes?: number;
  startTime?: number;
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

interface FileExplorerProps {
  session: GithubSession;
  onLogout: () => void;
}

export interface AttachedRepo {
  repo: string;
  branch: string;
}

interface MediaThumbnailProps {
  file: GithubFile;
  creds: {
    token: string;
    owner: string;
    repo: string;
    branch: string;
  };
}

const MediaThumbnail: React.FC<MediaThumbnailProps> = ({ file, creds }) => {
  const [src, setSrc] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [playing, setPlaying] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
  const videoExts = ['mp4', 'webm', 'ogg', 'mov'];
  const audioExts = ['mp3', 'wav', 'ogg', 'm4a'];

  useEffect(() => {
    if (file.type === 'dir') return;

    let active = true;
    let localUrl = '';
    const cdnUrl = getCdnUrl(creds.owner, creds.repo, creds.branch, file.path);

    const checkAndLoad = async () => {
      if (imageExts.includes(ext) || videoExts.includes(ext) || audioExts.includes(ext)) {
        // Try the CDN URL first
        try {
          const res = await fetch(cdnUrl, { method: 'HEAD' });
          if (res.ok && active) {
            setSrc(cdnUrl);
            setLoading(false);
            return;
          }
        } catch (e) {
          // If HEAD request fails, fallback to loading via raw file fetch (e.g. private repo)
        }

        // Fallback for private repository or failed CDN
        try {
          const blob = await fetchFileRaw(creds, file.path);
          if (active) {
            localUrl = URL.createObjectURL(blob);
            setSrc(localUrl);
            setLoading(false);
          }
        } catch (err) {
          console.error("Failed to load thumbnail for", file.name, err);
          if (active) {
            setError(true);
            setLoading(false);
          }
        }
      } else {
        setLoading(false);
      }
    };

    checkAndLoad();

    return () => {
      active = false;
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [file.path, file.sha]);

  // Clean up audio ref on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleAudioPlayToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!src) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.addEventListener('ended', () => {
        setPlaying(false);
      });
    }

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play().catch(err => console.error("Audio playback error:", err));
      setPlaying(true);
    }
  };

  if (file.type === 'dir') {
    return <Folder size={40} className="file-icon" style={{ color: 'var(--primary)' }} />;
  }

  if (loading) {
    return (
      <div className="thumbnail-spinner">
        <RefreshCw size={18} className="spin text-muted" />
      </div>
    );
  }

  if (error) {
    return <FileIcon size={36} className="text-muted" style={{ opacity: 0.5 }} />;
  }

  if (imageExts.includes(ext)) {
    return (
      <img 
        src={src} 
        alt={file.name} 
        className="file-thumbnail-img" 
        loading="lazy"
      />
    );
  }

  if (videoExts.includes(ext)) {
    return (
      <div 
        style={{ width: '100%', height: '100%', position: 'relative' }}
        onMouseEnter={(e) => {
          const video = e.currentTarget.querySelector('video');
          if (video) video.play().catch(() => {});
        }}
        onMouseLeave={(e) => {
          const video = e.currentTarget.querySelector('video');
          if (video) {
            video.pause();
            video.currentTime = 0;
          }
        }}
      >
        <video 
          src={src} 
          className="file-thumbnail-video" 
          muted 
          playsInline 
          loop 
          preload="metadata"
        />
        <div className="video-preview-badge">
          <span>PREVIEW</span>
        </div>
      </div>
    );
  }

  if (audioExts.includes(ext)) {
    return (
      <div className="file-thumbnail-audio">
        <Music size={30} style={{ color: '#a855f7', opacity: playing ? 1 : 0.6 }} />
        <button 
          className="audio-preview-btn" 
          onClick={handleAudioPlayToggle}
          title={playing ? "Pause preview" : "Play preview"}
          type="button"
        >
          {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" style={{ marginLeft: '1px' }} />}
        </button>
      </div>
    );
  }

  // Fallback for code, docx, pdf, spreadsheets, etc.
  const codeExts = ['html', 'css', 'js', 'ts', 'jsx', 'tsx', 'json', 'md', 'py', 'java', 'go', 'rs'];
  const sheetExts = ['xlsx', 'xls', 'csv'];
  const docxExts = ['docx'];

  if (ext === 'pdf') return <FileText size={36} style={{ color: '#f43f5e' }} />;
  if (sheetExts.includes(ext)) return <FileText size={36} style={{ color: '#10b981' }} />;
  if (docxExts.includes(ext)) return <FileText size={36} style={{ color: '#3b82f6' }} />;
  if (codeExts.includes(ext)) return <Code size={36} style={{ color: '#f59e0b' }} />;

  return <FileIcon size={36} className="text-muted" />;
};


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

  // Batch upload states
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [showProgressPanel, setShowProgressPanel] = useState<boolean>(false);
  const [isPanelMinimized, setIsPanelMinimized] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  // Drive-like states
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFileSha, setSelectedFileSha] = useState<string | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: GithubFile } | null>(null);
  const [previewFile, setPreviewFile] = useState<GithubFile | null>(null);

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

  // Click outside to clear selection / context menu
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

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

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !activeRepo) return;
    
    setLoading(true);
    try {
      const creds = {
        token: session.token,
        owner: session.owner,
        repo: activeRepo.repo,
        branch: activeRepo.branch
      };
      
      const folderPath = currentPath 
        ? `${currentPath}/${newFolderName.trim()}/.gitkeep` 
        : `${newFolderName.trim()}/.gitkeep`;
        
      // Upload empty file content (base64 of empty string is "")
      await uploadFile(creds, folderPath, "", `Create folder ${newFolderName.trim()}`);
      setNewFolderName('');
      setIsCreateFolderOpen(false);
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

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (!activeRepo || uploading) return;
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      try {
        const filesList = await parseDroppedItems(e.dataTransfer.items);
        if (filesList.length > 0) {
          startBatchUpload(filesList);
        }
      } catch (err) {
        console.error('Error scanning dropped files:', err);
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesList = Array.from(e.dataTransfer.files).map(file => ({
        file,
        relativePath: file.name
      }));
      startBatchUpload(filesList);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (uploading) return;
    if (e.target.files && e.target.files.length > 0) {
      const filesList = Array.from(e.target.files).map(file => ({
        file,
        relativePath: file.name
      }));
      startBatchUpload(filesList);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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

  const breadcrumbParts = currentPath.split('/').filter(Boolean);

  // Filters
  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(fileSearch.toLowerCase())
  );

  const filteredRepos = githubRepos.filter(r => 
    r.name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  // Analytics Calculations
  const activeRepoDetails = githubRepos.find(r => r.name.toLowerCase() === activeRepo?.repo.toLowerCase());
  const isPrivate = activeRepoDetails ? activeRepoDetails.private : false;

  const totalSizeBytes = repoTree
    .filter(item => item.type === 'blob')
    .reduce((acc, item) => acc + (item.size || 0), 0);

  const totalFiles = repoTree.filter(item => item.type === 'blob').length;
  const totalFolders = repoTree.filter(item => item.type === 'tree').length;
  const averageFileSize = totalFiles > 0 ? totalSizeBytes / totalFiles : 0;
  const storageLimitBytes = 1024 * 1024 * 1024; // 1 GB recommended
  const storagePercentage = Math.min(100, parseFloat(((totalSizeBytes / storageLimitBytes) * 100).toFixed(2)));

  const categories = [
    { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'tiff'], color: '#38bdf8', bgClass: 'bg-images' },
    { name: 'Videos & Audio', extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'], color: '#ec4899', bgClass: 'bg-media' },
    { name: 'Code & Scripts', extensions: ['html', 'js', 'ts', 'jsx', 'tsx', 'json', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'sh', 'php', 'rb', 'sql'], color: '#f59e0b', bgClass: 'bg-code' },
    { name: 'Stylesheets', extensions: ['css', 'scss', 'sass', 'less'], color: '#10b981', bgClass: 'bg-styles' },
    { name: 'Documents', extensions: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'txt', 'md', 'pptx', 'ppt', 'zip', 'tar', 'gz'], color: '#3b82f6', bgClass: 'bg-docs' },
    { name: 'Others', extensions: [], color: '#6b7280', bgClass: 'bg-others' }
  ];

  const distribution = categories.map(cat => ({
    name: cat.name,
    color: cat.color,
    count: 0,
    size: 0,
    percentage: 0
  }));

  repoTree.forEach(item => {
    if (item.type !== 'blob') return;
    const ext = item.path.split('.').pop()?.toLowerCase() || '';
    let found = false;
    for (let i = 0; i < categories.length - 1; i++) {
      if (categories[i].extensions.includes(ext)) {
        distribution[i].count++;
        distribution[i].size += (item.size || 0);
        found = true;
        break;
      }
    }
    if (!found) {
      distribution[categories.length - 1].count++;
      distribution[categories.length - 1].size += (item.size || 0);
    }
  });

  distribution.forEach(d => {
    d.percentage = totalSizeBytes > 0 ? parseFloat(((d.size / totalSizeBytes) * 100).toFixed(1)) : 0;
  });

  const largestFiles = [...repoTree]
    .filter(item => item.type === 'blob')
    .sort((a, b) => (b.size || 0) - (a.size || 0))
    .slice(0, 10);

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
                <button className="btn btn-outline" onClick={() => { loadContents(); loadRepoTree(); }} disabled={loading || uploading}>
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

            {/* Workspace tabs */}
            <div className="workspace-tabs-container glass-panel">
              <button 
                className={`workspace-tab ${activeTab === 'explorer' ? 'active' : ''}`}
                onClick={() => setActiveTab('explorer')}
              >
                <Folder size={14} />
                <span>Bucket Explorer</span>
              </button>
              <button 
                className={`workspace-tab ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('analytics')}
              >
                <BarChart2 size={14} />
                <span>Storage Analytics</span>
              </button>
            </div>

            {activeTab === 'explorer' ? (
              <>
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
                              handleNavigate(file.path);
                            } else {
                              setPreviewFile(file);
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
                                  setPreviewFile(file);
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
                                  handleCopyCdn(file);
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
                                handleDelete(file);
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
                                  handleNavigate(file.path);
                                } else {
                                  setPreviewFile(file);
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
                                        setPreviewFile(file);
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
                                      handleCopyCdn(file);
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
                                      handleDelete(file);
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
          </>
        ) : (
          <div className="analytics-dashboard-container animate-fade-in">
            {loadingTree ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem', gap: '1rem' }}>
                <RefreshCw size={28} className="spin text-primary" />
                <span className="text-muted" style={{ fontSize: '0.9rem' }}>Analyzing repository storage...</span>
              </div>
            ) : treeError ? (
              <div className="analytics-error-banner glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center' }}>
                <AlertCircle size={32} style={{ color: 'var(--danger)' }} />
                <div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: 600 }}>Failed to Load Storage Analytics</h3>
                  <p className="text-muted" style={{ fontSize: '0.9rem', maxWidth: '400px' }}>{treeError}</p>
                </div>
                <button className="btn btn-outline" onClick={() => loadRepoTree()}>
                  Retry Analysis
                </button>
              </div>
            ) : (
              <>
                {/* Metrics Grid Cards */}
                <div className="metrics-grid">
                  {/* Metric Card 1: Storage Limit */}
                  <div className="metric-card glass-panel">
                    <div className="metric-card-header">
                      <span className="metric-card-title">Storage Consumed</span>
                      <HardDrive size={16} className="metric-card-icon text-primary" />
                    </div>
                    <div className="metric-value-container">
                      <span className="metric-value">{formatBytes(totalSizeBytes)}</span>
                      <span className="metric-limit">/ 1.0 GB</span>
                    </div>
                    <div className="metric-progress-wrapper">
                      <div className="metric-progress-bar-container">
                        <div className="metric-progress-bar-fill" style={{ width: `${storagePercentage}%` }} />
                      </div>
                      <span className="metric-progress-text">{storagePercentage}% Used</span>
                    </div>
                  </div>

                  {/* Metric Card 2: Total Objects */}
                  <div className="metric-card glass-panel">
                    <div className="metric-card-header">
                      <span className="metric-card-title">Total Objects</span>
                      <Database size={16} className="metric-card-icon text-success" />
                    </div>
                    <div className="metric-value">{totalFiles + totalFolders}</div>
                    <div className="metric-stats-details">
                      <span>{totalFiles} files</span>
                      <span className="bullet-separator">•</span>
                      <span>{totalFolders} folders</span>
                    </div>
                  </div>

                  {/* Metric Card 3: Average File Size */}
                  <div className="metric-card glass-panel">
                    <div className="metric-card-header">
                      <span className="metric-card-title">Average File Size</span>
                      <FileText size={16} className="metric-card-icon" style={{ color: '#f59e0b' }} />
                    </div>
                    <div className="metric-value">{formatBytes(averageFileSize)}</div>
                    <span className="metric-subtitle">Across all recursive files</span>
                  </div>

                  {/* Metric Card 4: Access Mode */}
                  <div className="metric-card glass-panel">
                    <div className="metric-card-header">
                      <span className="metric-card-title">Bucket Access Mode</span>
                      {isPrivate ? (
                        <Lock size={16} className="metric-card-icon text-danger" />
                      ) : (
                        <Unlock size={16} className="metric-card-icon text-success" />
                      )}
                    </div>
                    <div className="metric-value" style={{ fontSize: '1.5rem', marginTop: '0.2rem' }}>
                      {isPrivate ? 'Private Repository' : 'Public Access'}
                    </div>
                    <span className="metric-subtitle" style={{ color: isPrivate ? '#f87171' : '#4ade80' }}>
                      {isPrivate ? 'CDN access might be restricted' : 'Global CDN distribution active'}
                    </span>
                  </div>
                </div>

                {/* File-type distribution ratios */}
                <div className="analytics-section glass-panel">
                  <div className="section-header">
                    <h2 className="section-title">File-Type Distribution</h2>
                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>Ratio of total repository storage consumed</span>
                  </div>

                  {/* Segmented Bar Chart */}
                  <div className="distribution-bar-container">
                    <div className="distribution-bar">
                      {distribution.map((segment, idx) => (
                        segment.percentage > 0 && (
                          <div
                            key={idx}
                            className="distribution-segment"
                            style={{
                              width: `${segment.percentage}%`,
                              backgroundColor: segment.color
                            }}
                            title={`${segment.name}: ${formatBytes(segment.size)} (${segment.percentage}%)`}
                          />
                        )
                      ))}
                      {totalFiles === 0 && (
                        <div className="distribution-segment empty" style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.05)' }} />
                      )}
                    </div>
                  </div>

                  {/* Distribution Legend Grid */}
                  <div className="distribution-legend-grid">
                    {distribution.map((segment, idx) => (
                      <div key={idx} className="legend-item glass-card">
                        <div className="legend-header">
                          <span className="legend-color-dot" style={{ backgroundColor: segment.color }} />
                          <span className="legend-name">{segment.name}</span>
                        </div>
                        <div className="legend-body">
                          <span className="legend-size">{formatBytes(segment.size)}</span>
                          <span className="legend-percentage">{segment.percentage}%</span>
                        </div>
                        <div className="legend-footer text-muted">
                          {segment.count} file{segment.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Largest Files Table */}
                <div className="analytics-section glass-panel" style={{ marginBottom: 0 }}>
                  <div className="section-header">
                    <h2 className="section-title">Largest Files (Bandwidth Hogs)</h2>
                    <span className="text-muted" style={{ fontSize: '0.85rem' }}>Top 10 largest objects in repository</span>
                  </div>

                  <div className="largest-files-table-container">
                    <table className="largest-files-table">
                      <thead>
                        <tr>
                          <th>Path & Name</th>
                          <th>Size</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {largestFiles.map((file, idx) => {
                          const ext = file.path.split('.').pop()?.toLowerCase() || '';
                          const isHog = (file.size || 0) > 10 * 1024 * 1024; // > 10MB
                          const getTreeFileIcon = () => {
                            const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'];
                            const videoExts = ['mp4', 'webm', 'ogg', 'mov'];
                            const audioExts = ['mp3', 'wav', 'ogg', 'm4a'];
                            const codeExts = ['html', 'css', 'js', 'ts', 'jsx', 'tsx', 'json', 'md', 'py', 'java', 'go', 'rs'];
                            const sheetExts = ['xlsx', 'xls', 'csv'];
                            const docxExts = ['docx'];

                            if (imageExts.includes(ext)) return <ImageIcon size={16} style={{ color: '#38bdf8' }} />;
                            if (videoExts.includes(ext)) return <Video size={16} style={{ color: '#ec4899' }} />;
                            if (audioExts.includes(ext)) return <Music size={16} style={{ color: '#a855f7' }} />;
                            if (ext === 'pdf') return <FileText size={16} style={{ color: '#f43f5e' }} />;
                            if (sheetExts.includes(ext)) return <FileText size={16} style={{ color: '#10b981' }} />;
                            if (docxExts.includes(ext)) return <FileText size={16} style={{ color: '#3b82f6' }} />;
                            if (codeExts.includes(ext)) return <Code size={16} style={{ color: '#f59e0b' }} />;
                            return <FileIcon size={16} />;
                          };

                          const handleLocateFile = (fileItem: GithubTreeItem) => {
                            const parts = fileItem.path.split('/');
                            parts.pop(); // Remove file name
                            const folderPath = parts.join('/');
                            setCurrentPath(folderPath);
                            setSelectedFileSha(fileItem.sha);
                            setActiveTab('explorer');
                            loadContents(folderPath);
                          };

                          const handleCopyTreeCdn = () => {
                            const url = getCdnUrl(session.owner, activeRepo.repo, activeRepo.branch, file.path);
                            navigator.clipboard.writeText(url);
                            setCopiedFileUrl(url);
                            setTimeout(() => setCopiedFileUrl(null), 2000);
                          };

                          const handleTreeDelete = async () => {
                            if (confirm(`Are you sure you want to delete "${file.path}"?`)) {
                              setLoadingTree(true);
                              try {
                                const creds = {
                                  token: session.token,
                                  owner: session.owner,
                                  repo: activeRepo.repo,
                                  branch: activeRepo.branch
                                };
                                await deleteFile(creds, file.path, file.sha);
                                await loadContents();
                                await loadRepoTree();
                              } catch (err: any) {
                                console.error(err);
                                alert(`Failed to delete file: ${err.message || 'Unknown error'}`);
                                setLoadingTree(false);
                              }
                            }
                          };

                          return (
                            <tr key={idx} className={isHog ? 'hog-row' : ''}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  {getTreeFileIcon()}
                                  <span className="file-path-text" title={file.path}>{file.path}</span>
                                </div>
                              </td>
                              <td>
                                <span className={`file-size-text ${isHog ? 'text-warning font-semibold' : ''}`}>
                                  {formatBytes(file.size || 0)}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                  <button
                                    className="btn-icon"
                                    onClick={handleCopyTreeCdn}
                                    title="Copy CDN Link"
                                  >
                                    <Copy size={13} />
                                  </button>
                                  <button
                                    className="btn-icon"
                                    onClick={() => handleLocateFile(file)}
                                    title="Locate in Explorer"
                                  >
                                    <ExternalLink size={13} />
                                  </button>
                                  <button
                                    className="btn-icon"
                                    style={{ color: 'var(--danger)' }}
                                    onClick={handleTreeDelete}
                                    title="Delete File"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {largestFiles.length === 0 && (
                          <tr>
                            <td colSpan={3} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                              No files found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
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
              <p className="text-muted" style={{ maxWidth: '600px', fontSize: '1rem', lineHeight: '1.5', marginBottom: '1.25rem' }}>
                Connect your GitHub repositories to convert them into S3-like storage buckets with free, global jsDelivr edge CDN link sharing.
              </p>
              <div style={{
                background: 'rgba(245, 158, 11, 0.05)',
                border: '1px solid rgba(245, 158, 11, 0.15)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                fontSize: '0.85rem',
                color: '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                maxWidth: '650px',
                lineHeight: '1.4',
                textAlign: 'left'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Tip:</strong> We recommend attaching repositories owned by a <strong>secondary/burner GitHub account</strong>. Since uploads write commits directly to your repos, this prevents polluting your primary developer account's contribution graphs and commit histories.
                </span>
              </div>
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
            <form onSubmit={handleCreateFolder}>
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
                setPreviewFile(contextMenu.file);
                setContextMenu(null);
              }}
            >
              <Eye size={14} /> Preview File
            </button>
          )}
          <button 
            className="context-menu-item" 
            onClick={() => {
              handleCopyCdn(contextMenu.file);
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
              handleDelete(contextMenu.file);
              setContextMenu(null);
            }}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}

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
      {showProgressPanel && (
        <div className={`upload-progress-panel glass-panel ${isPanelMinimized ? 'minimized' : ''}`}>
          <div className="upload-progress-header" onClick={() => setIsPanelMinimized(!isPanelMinimized)}>
            <div className="upload-progress-title">
              {uploadQueue.some(i => i.status === 'uploading') ? (
                <>
                  <RefreshCw size={14} className="spin text-primary" />
                  <span>Uploading {uploadQueue.filter(i => i.status === 'completed').length + uploadQueue.filter(i => i.status === 'uploading').length}/{uploadQueue.length} files...</span>
                </>
              ) : uploadQueue.some(i => i.status === 'failed') ? (
                <>
                  <AlertCircle size={14} className="text-danger" />
                  <span>Upload completed with errors</span>
                </>
              ) : (
                <>
                  <Check size={14} className="text-success" />
                  <span>Upload queue complete</span>
                </>
              )}
            </div>
            <div className="upload-progress-controls" onClick={(e) => e.stopPropagation()}>
              <button 
                className="btn-icon" 
                onClick={() => setIsPanelMinimized(!isPanelMinimized)} 
                title={isPanelMinimized ? "Expand" : "Minimize"}
                style={{ padding: '4px' }}
              >
                {isPanelMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </button>
              {!uploadQueue.some(i => i.status === 'uploading') && (
                <button 
                  className="btn-icon" 
                  onClick={() => setShowProgressPanel(false)} 
                  title="Close"
                  style={{ padding: '4px' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          
          {!isPanelMinimized && (
            <div className="upload-progress-body">
              {(() => {
                const totalSize = uploadQueue.reduce((acc, item) => acc + item.size, 0);
                const totalUploadedBytes = uploadQueue.reduce((acc, item) => {
                  if (item.status === 'completed') return acc + item.size;
                  if (item.status === 'uploading') return acc + (item.size * (item.progress / 100));
                  return acc;
                }, 0);
                const overallProgress = totalSize > 0 ? Math.round((totalUploadedBytes / totalSize) * 100) : 0;
                const speed = elapsedTime > 0 ? totalUploadedBytes / elapsedTime : 0;
                
                const formatSpeed = (bytesPerSecond: number) => {
                  if (bytesPerSecond === 0) return '—';
                  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
                  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
                  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
                };

                const getETA = () => {
                  const remainingBytes = totalSize - totalUploadedBytes;
                  if (remainingBytes <= 0) return '0s';
                  if (speed <= 0) return 'Calculating...';
                  const seconds = Math.ceil(remainingBytes / speed);
                  if (seconds < 60) return `${seconds}s`;
                  const minutes = Math.floor(seconds / 60);
                  const remSeconds = seconds % 60;
                  return `${minutes}m ${remSeconds}s`;
                };

                const getQueueFileIcon = (fileName: string) => {
                  const ext = fileName.split('.').pop()?.toLowerCase() || '';
                  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'];
                  const videoExts = ['mp4', 'webm', 'ogg', 'mov'];
                  const audioExts = ['mp3', 'wav', 'ogg', 'm4a'];
                  const codeExts = ['html', 'css', 'js', 'ts', 'jsx', 'tsx', 'json', 'md', 'py', 'java', 'go', 'rs'];
                  const sheetExts = ['xlsx', 'xls', 'csv'];
                  const docxExts = ['docx'];

                  if (imageExts.includes(ext)) return <ImageIcon size={14} style={{ color: '#38bdf8' }} />;
                  if (videoExts.includes(ext)) return <Video size={14} style={{ color: '#ec4899' }} />;
                  if (audioExts.includes(ext)) return <Music size={14} style={{ color: '#a855f7' }} />;
                  if (ext === 'pdf') return <FileText size={14} style={{ color: '#f43f5e' }} />;
                  if (sheetExts.includes(ext)) return <FileText size={14} style={{ color: '#10b981' }} />;
                  if (docxExts.includes(ext)) return <FileText size={14} style={{ color: '#3b82f6' }} />;
                  if (codeExts.includes(ext)) return <Code size={14} style={{ color: '#f59e0b' }} />;
                  return <FileIcon size={14} />;
                };

                return (
                  <>
                    <div className="overall-progress-info">
                      <div className="overall-stats-text">
                        <span>{formatBytes(totalUploadedBytes)} of {formatBytes(totalSize)}</span>
                        <span>{overallProgress}%</span>
                      </div>
                      <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${overallProgress}%` }}></div>
                      </div>
                      <div className="overall-stats-text" style={{ marginTop: '2px' }}>
                        <span>Speed: {formatSpeed(speed)}</span>
                        {uploadQueue.some(i => i.status === 'uploading') && <span>ETA: {getETA()}</span>}
                      </div>
                    </div>
                    
                    <div className="upload-queue-list">
                      {uploadQueue.map((item) => (
                        <div className="queue-item" key={item.id}>
                          <div className="queue-item-icon-wrapper">
                            {getQueueFileIcon(item.name)}
                          </div>
                          <div className="queue-item-details">
                            <div className="queue-item-name" title={item.relativePath || item.name}>
                              {item.relativePath || item.name}
                            </div>
                            <div className="queue-item-meta">
                              <span>{formatBytes(item.size)}</span>
                              {item.status === 'uploading' && <span>{item.progress}%</span>}
                              {item.status === 'completed' && <span className="status-badge-completed">Completed</span>}
                              {item.status === 'failed' && <span className="status-badge-failed" title={item.error}>Failed</span>}
                              {item.status === 'pending' && <span>Queued</span>}
                            </div>
                          </div>
                          
                          <div className="queue-item-status-wrapper" title={item.status === 'failed' ? item.error : undefined}>
                            {item.status === 'uploading' && <RefreshCw size={12} className="spin status-badge-uploading" />}
                            {item.status === 'completed' && <Check size={12} className="status-badge-completed" />}
                            {item.status === 'failed' && <AlertCircle size={12} className="status-badge-failed" />}
                          </div>
                          
                          {item.status === 'uploading' && (
                            <div className="queue-item-progress-bar" style={{ width: `${item.progress}%` }}></div>
                          )}
                          {item.status === 'completed' && (
                            <div className="queue-item-progress-bar completed" style={{ width: '100%' }}></div>
                          )}
                          {item.status === 'failed' && (
                            <div className="queue-item-progress-bar failed" style={{ width: '100%' }}></div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
