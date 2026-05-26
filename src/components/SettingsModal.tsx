import React, { useState } from 'react';
import { GithubCredentials } from '../lib/github';
import { Github, Key, Save } from 'lucide-react';

interface SettingsModalProps {
  initialCreds: Partial<GithubCredentials>;
  onSave: (creds: GithubCredentials) => void;
  isClosable: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ initialCreds, onSave, isClosable }) => {
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
      <div className="modal-content glass-card">
        <div className="app-title" style={{ marginBottom: '1.5rem', justifyContent: 'center' }}>
          <Github className="spin" style={{ animationDuration: '3s' }} />
          <h2 className="text-gradient">Connect Repository</h2>
        </div>
        
        <p className="text-muted" style={{ marginBottom: '2rem', textAlign: 'center', fontSize: '0.9rem' }}>
          Provide your GitHub Personal Access Token (PAT) and target repository to start using it as an S3 bucket.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Personal Access Token</label>
            <div style={{ position: 'relative' }}>
              <Key style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
              <input 
                type="password" 
                className="input-field" 
                style={{ paddingLeft: '2.5rem' }}
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
              placeholder="e.g. main" 
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            {/* If there's already valid creds, we can show a cancel button, but for simplicity let's just make them submit to close */}
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              <Save size={18} /> Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
