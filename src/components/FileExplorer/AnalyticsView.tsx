import React from 'react';
import type { GithubSession } from '../../App';
import type { GithubTreeItem } from '../../api/types';
import type { AttachedRepo } from './types';
import { 
  AlertCircle, 
  RefreshCw, 
  HardDrive, 
  Database, 
  FileText, 
  Lock, 
  Unlock 
} from 'lucide-react';
import { DonutChart } from './DonutChart';
import { AreaChart } from './AreaChart';
import { LargestFilesTable } from './LargestFilesTable';

interface AnalyticsViewProps {
  session: GithubSession;
  activeRepo: AttachedRepo;
  repoTree: GithubTreeItem[];
  loadingTree: boolean;
  treeError: string | null;
  loadRepoTree: () => void;
  isPrivate: boolean;
  onLocateFile: (filePath: string, sha: string) => void;
  onCopyTreeCdn: (url: string) => void;
  onDeleteTreeFile: (path: string, sha: string) => Promise<void>;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  session,
  activeRepo,
  repoTree,
  loadingTree,
  treeError,
  loadRepoTree,
  isPrivate,
  onLocateFile,
  onCopyTreeCdn,
  onDeleteTreeFile
}) => {

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0 || !bytes) return '—';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Analytics Calculations
  const totalSizeBytes = repoTree
    .filter(item => item.type === 'blob')
    .reduce((acc, item) => acc + (item.size || 0), 0);

  const totalFiles = repoTree.filter(item => item.type === 'blob').length;
  const totalFolders = repoTree.filter(item => item.type === 'tree').length;
  const averageFileSize = totalFiles > 0 ? totalSizeBytes / totalFiles : 0;
  const storageLimitBytes = 1024 * 1024 * 1024; // 1 GB recommended
  const storagePercentage = Math.min(100, parseFloat(((totalSizeBytes / storageLimitBytes) * 100).toFixed(2)));

  const categories = [
    { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'tiff'], color: '#00f0ff', bgClass: 'bg-images' },
    { name: 'Videos & Audio', extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'], color: '#a855f7', bgClass: 'bg-media' },
    { name: 'Code & Scripts', extensions: ['html', 'js', 'ts', 'jsx', 'tsx', 'json', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'sh', 'php', 'rb', 'sql'], color: '#ff8c00', bgClass: 'bg-code' },
    { name: 'Stylesheets', extensions: ['css', 'scss', 'sass', 'less'], color: '#ff007f', bgClass: 'bg-styles' },
    { name: 'Documents', extensions: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'txt', 'md', 'pptx', 'ppt', 'zip', 'tar', 'gz'], color: '#39ff14', bgClass: 'bg-docs' },
    { name: 'Others', extensions: [], color: '#94a3b8', bgClass: 'bg-others' }
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

  if (loadingTree) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem', gap: '1rem' }}>
        <RefreshCw size={28} className="spin text-primary" />
        <span className="text-muted" style={{ fontSize: '0.9rem' }}>Analyzing repository storage...</span>
      </div>
    );
  }

  if (treeError) {
    return (
      <div className="analytics-error-banner glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center' }}>
        <AlertCircle size={32} style={{ color: 'var(--danger)' }} />
        <div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: 600 }}>Failed to Load Storage Analytics</h3>
          <p className="text-muted" style={{ fontSize: '0.9rem', maxWidth: '400px' }}>{treeError}</p>
        </div>
        <button className="btn btn-outline" onClick={loadRepoTree}>
          Retry Analysis
        </button>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard-container animate-fade-in">
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

      {/* Interactive SVG Charts Section (Donut & Area Charts) */}
      <div className="charts-grid">
        <DonutChart 
          distribution={distribution}
          totalSizeBytes={totalSizeBytes}
          totalFiles={totalFiles}
          formatBytes={formatBytes}
        />
        <AreaChart 
          repoName={activeRepo.repo}
          totalSizeBytes={totalSizeBytes}
          totalFiles={totalFiles}
          formatBytes={formatBytes}
        />
      </div>

      {/* Largest Files Table */}
      <LargestFilesTable 
        largestFiles={largestFiles}
        session={session}
        activeRepo={activeRepo}
        formatBytes={formatBytes}
        onLocateFile={onLocateFile}
        onCopyTreeCdn={onCopyTreeCdn}
        onDeleteTreeFile={onDeleteTreeFile}
      />
    </div>
  );
};
