import React from 'react';
import type { GithubSession } from '../../App';
import type { GithubTreeItem } from '../../api/types';
import type { AttachedRepo } from './types';
import { getCdnUrl } from '../../api/client';
import { 
  AlertCircle, 
  RefreshCw, 
  HardDrive, 
  Database, 
  FileText, 
  Lock, 
  Unlock, 
  Image as ImageIcon, 
  Video, 
  Music, 
  Code, 
  File as FileIcon, 
  ExternalLink, 
  Trash2, 
  Copy 
} from 'lucide-react';

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

                const handleCopyTreeCdnClick = () => {
                  const url = getCdnUrl(session.owner, activeRepo.repo, activeRepo.branch, file.path);
                  onCopyTreeCdn(url);
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
                          onClick={handleCopyTreeCdnClick}
                          title="Copy CDN Link"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => onLocateFile(file.path, file.sha)}
                          title="Locate in Explorer"
                        >
                          <ExternalLink size={13} />
                        </button>
                        <button
                          className="btn-icon"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => onDeleteTreeFile(file.path, file.sha)}
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
    </div>
  );
};
