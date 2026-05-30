import React from 'react';
import type { GithubProfile } from '../../lib/github';
import type { GithubSession } from '../../App';
import type { AttachedRepo } from './types';
import { Plus, BookOpen, X, LogOut, User } from 'lucide-react';
import { AstroBucketLogo } from '../AstroBucketLogo';

interface SidebarProps {
  session: GithubSession;
  profile: GithubProfile | null;
  attachedRepos: AttachedRepo[];
  activeRepo: AttachedRepo | null;
  selectRepo: (repo: AttachedRepo | null) => void;
  detachRepo: (e: React.MouseEvent, repoToDetach: AttachedRepo) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  session,
  profile,
  attachedRepos,
  activeRepo,
  selectRepo,
  detachRepo,
  onLogout
}) => {
  return (
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
  );
};
