import React from 'react';
import { 
  Copy, 
  ExternalLink, 
  Trash2, 
  Image as ImageIcon, 
  Video, 
  Music, 
  FileText, 
  Code, 
  File as FileIcon 
} from 'lucide-react';
import type { GithubSession } from '../../App';
import type { AttachedRepo } from './types';
import type { GithubTreeItem } from '../../api/types';
import { getCdnUrl } from '../../api/client';

interface LargestFilesTableProps {
  largestFiles: GithubTreeItem[];
  session: GithubSession;
  activeRepo: AttachedRepo;
  formatBytes: (bytes: number) => string;
  onLocateFile: (filePath: string, sha: string) => void;
  onCopyTreeCdn: (url: string) => void;
  onDeleteTreeFile: (path: string, sha: string) => Promise<void>;
}

export const LargestFilesTable: React.FC<LargestFilesTableProps> = ({
  largestFiles,
  session,
  activeRepo,
  formatBytes,
  onLocateFile,
  onCopyTreeCdn,
  onDeleteTreeFile
}) => {
  return (
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
  );
};
