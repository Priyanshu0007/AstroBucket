import React, { useState } from 'react';
import type { GithubSession } from '../../App';
import type { GithubRepo } from '../../lib/github';
import type { AttachedRepo } from './types';
import { AlertCircle, BookOpen, Trash2, RefreshCw, Search, Plus } from 'lucide-react';

interface WelcomeDashboardProps {
  session: GithubSession;
  attachedRepos: AttachedRepo[];
  githubRepos: GithubRepo[];
  fetchingRepos: boolean;
  loadGithubRepos: () => void;
  attachRepo: (repoName: string, branchName: string) => void;
  detachRepo: (e: React.MouseEvent, repoToDetach: AttachedRepo) => void;
  selectRepo: (repo: AttachedRepo | null) => void;
}

export const WelcomeDashboard: React.FC<WelcomeDashboardProps> = ({
  session,
  attachedRepos,
  githubRepos,
  fetchingRepos,
  loadGithubRepos,
  attachRepo,
  detachRepo,
  selectRepo
}) => {
  const [repoSearch, setRepoSearch] = useState('');
  const [manualRepo, setManualRepo] = useState('');
  const [manualBranch, setManualBranch] = useState('main');
  const [manualError, setManualError] = useState('');
  const [attachingManual, setAttachingManual] = useState(false);

  // Filter repositories locally
  const filteredRepos = githubRepos.filter(r => 
    r.name.toLowerCase().includes(repoSearch.toLowerCase())
  );

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

  return (
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
  );
};
