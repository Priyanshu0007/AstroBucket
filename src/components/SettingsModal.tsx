import React, { useState } from 'react';
import type { GithubCredentials } from '../lib/github';
import { Key, Save, X } from 'lucide-react';
import { AstroBucketLogo } from './AstroBucketLogo';

/**
 * SettingsModalProps
 * 
 * Props for the Repository Connection Modal.
 * - initialCreds: Any saved credentials to pre-fill the form fields.
 * - onSave: Callback function triggered when saving/connecting.
 * - isClosable: If true, allows dismissing the modal (e.g. from the landing page).
 * - onClose: Optional callback to close the modal.
 */
interface SettingsModalProps {
  initialCreds: Partial<GithubCredentials>;
  onSave: (creds: GithubCredentials) => void;
  isClosable: boolean;
  onClose?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  initialCreds, 
  onSave, 
  isClosable,
  onClose 
}) => {
  const [token, setToken] = useState(initialCreds.token || '');
  const [owner, setOwner] = useState(initialCreds.owner || '');
  const [repo, setRepo] = useState(initialCreds.repo || '');
  const [branch, setBranch] = useState(initialCreds.branch || 'main');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token && owner && repo && branch) {
      onSave({ token, owner, repo, branch });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card" style={{ position: 'relative', border: '1px solid rgba(255,255,255,0.06)' }}>
        
        {/* Render a Close button if the modal is configured as closable */}
        {isClosable && onClose && (
          <button 
            type="button" 
            className="modal-close-btn" 
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        )}

        <div className="app-title" style={{ marginBottom: '1.5rem', justifyContent: 'center' }}>
          <AstroBucketLogo style={{ color: '#60a5fa' }} size={32} />
          <h2 className="text-gradient-hero" style={{ fontSize: '1.75rem', fontWeight: 700 }}>Connect Repository</h2>
        </div>
        
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem', lineHeight: '1.4' }}>
            Provide your GitHub Personal Access Token (PAT) and target repository to start using it as an S3-like CDN bucket.
          </p>
          <p className="text-muted" style={{ fontSize: '0.85rem', color: '#a855f7' }}>
            <strong>Recommendation:</strong> Use a <strong>Classic Token</strong> with the <code>repo</code> scope selected.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Personal Access Token</label>
            <div style={{ position: 'relative' }}>
              <Key style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
              <input 
                type="password" 
                className="input-field" 
                style={{ paddingLeft: '2.5rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}
                placeholder="ghp_xxxxxxxxxxxx" 
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Repository Owner</label>
            <input 
              type="text" 
              className="input-field" 
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}
              placeholder="e.g. your-username" 
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Repository Name</label>
            <input 
              type="text" 
              className="input-field" 
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}
              placeholder="e.g. my-cdn-bucket" 
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              required
            />
          </div>

          <div className="input-group" style={{ marginBottom: '2rem' }}>
            <label className="input-label">Branch</label>
            <input 
              type="text" 
              className="input-field" 
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}
              placeholder="e.g. main" 
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-glowing" style={{ width: '100%', justifyContent: 'center', borderRadius: '8px' }}>
              <Save size={18} /> Connect Repository
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
