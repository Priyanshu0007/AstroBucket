import React, { useState } from 'react';
import { Key, Save, X, User, AlertTriangle } from 'lucide-react';
import { AstroBucketLogo } from './AstroBucketLogo';

/**
 * SettingsModalProps
 * 
 * Props for the Repository Connection Modal.
 * - initialToken: Saved token to pre-fill.
 * - initialOwner: Saved owner to pre-fill.
 * - onSave: Callback function triggered when saving/connecting.
 * - isClosable: If true, allows dismissing the modal.
 * - onClose: Optional callback to close the modal.
 */
interface SettingsModalProps {
  initialToken?: string;
  initialOwner?: string;
  onSave: (token: string, owner: string) => void;
  isClosable: boolean;
  onClose?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  initialToken = '', 
  initialOwner = '', 
  onSave, 
  isClosable,
  onClose 
}) => {
  const [token, setToken] = useState(initialToken);
  const [owner, setOwner] = useState(initialOwner);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim() && owner.trim()) {
      setConnecting(true);
      setError('');
      try {
        // Basic validation: attempt to verify the credentials by fetching user info
        const headers = {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token.trim()}`,
          'X-GitHub-Api-Version': '2022-11-28',
        };
        const response = await fetch(`https://api.github.com/users/${owner.trim()}`, { headers });
        if (!response.ok) {
          throw new Error(
            response.status === 401 
              ? 'Invalid Personal Access Token.' 
              : `Owner "${owner}" not found or API rate limit exceeded.`
          );
        }
        
        onSave(token.trim(), owner.trim());
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Verification failed. Please check token and owner username.');
      } finally {
        setConnecting(false);
      }
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
            disabled={connecting}
          >
            <X size={20} />
          </button>
        )}

        <div className="app-title" style={{ marginBottom: '1.5rem', justifyContent: 'center' }}>
          <AstroBucketLogo style={{ color: '#60a5fa' }} size={32} />
          <h2 className="text-gradient-hero" style={{ fontSize: '1.75rem', fontWeight: 700 }}>Connect GitHub</h2>
        </div>
        
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem', lineHeight: '1.4' }}>
            Provide your GitHub Personal Access Token (PAT) and username to start connecting your CDN buckets.
          </p>
          <p className="text-muted" style={{ fontSize: '0.85rem', color: '#a855f7', marginBottom: '0.75rem' }}>
            <strong>Recommendation:</strong> Use a <strong>Classic Token</strong> with the <code>repo</code> scope selected.
          </p>
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: '8px',
            padding: '0.75rem',
            fontSize: '0.8rem',
            color: '#fbbf24',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textAlign: 'left',
            lineHeight: '1.4'
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>
              <strong>Note:</strong> We highly recommend using a <strong>secondary/burner GitHub account</strong>. AstroBucket commits files directly, which will alter your primary developer account's contribution graphs and commit histories.
            </span>
          </div>
        </div>

        {error && (
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            color: '#f87171', 
            padding: '0.75rem', 
            borderRadius: '8px', 
            fontSize: '0.85rem', 
            marginBottom: '1.25rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

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
                disabled={connecting}
              />
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '2rem' }}>
            <label className="input-label">GitHub Username / Owner</label>
            <div style={{ position: 'relative' }}>
              <User style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={18} />
              <input 
                type="text" 
                className="input-field" 
                style={{ paddingLeft: '2.5rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}
                placeholder="e.g. your-username" 
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                required
                disabled={connecting}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button 
              type="submit" 
              className="btn btn-glowing" 
              style={{ width: '100%', justifyContent: 'center', borderRadius: '8px' }}
              disabled={connecting}
            >
              <Save size={18} /> {connecting ? 'Verifying...' : 'Connect Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

