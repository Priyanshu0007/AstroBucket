import React, { useState } from 'react';
import axios from 'axios';
import { Key, Save, X, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { AstroBucketLogo } from './AstroBucketLogo';
import { fetchUserProfile } from '../api/client';
import { environmentConfig } from '../config/environmentConfig';
import { GithubIcon } from './GithubIcon';

interface SettingsModalProps {
  initialToken?: string;
  initialOwner?: string;
  onSave: (token: string, owner: string) => void;
  isClosable: boolean;
  onClose?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  initialToken = '', 
  onSave, 
  isClosable,
  onClose 
}) => {
  const [token, setToken] = useState(initialToken);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  // Trigger real OAuth redirect flow
  const handleGithubOAuth = () => {
    setError('');
    const clientId = environmentConfig.githubClientId;
    const redirectUri = environmentConfig.githubRedirectUri;

    if (!clientId) {
      setError('GitHub Client ID is not configured. Please define VITE_GITHUB_CLIENT_ID in your environment or use the local PAT fallback below.');
      return;
    }

    // Redirect to GitHub authorize page
    const scope = encodeURIComponent('repo read:user');
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  };

  // Trigger manual local development fallback flow
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setConnecting(true);
    setError('');

    try {
      // Exchange PAT directly to fetch user details (auto-discovering username)
      const userProfile = await fetchUserProfile(token.trim());
      if (userProfile?.login) {
        onSave(token.trim(), userProfile.login);
      } else {
        throw new Error('Failed to parse user profile details.');
      }
    } catch (err) {
      console.error('PAT verification error:', err);
      let errMsg = 'Verification failed. Please check your token and network connection.';
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        errMsg = 'Invalid Personal Access Token. Make sure scopes are correct.';
      }
      setError(errMsg);
    } finally {
      setConnecting(false);
    }
  };

  const hasClientId = !!environmentConfig.githubClientId;

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-card" style={{ position: 'relative', border: '1px solid rgba(255,255,255,0.06)', maxWidth: '440px' }}>
        
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
        
        <div style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.75rem', lineHeight: '1.4' }}>
            Link your GitHub account to transform repositories into edge-cached jsDelivr CDN buckets.
          </p>

          {/* Alert explaining why we recommend burner accounts */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.06)',
            border: '1px solid rgba(245, 158, 11, 0.15)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            fontSize: '0.8rem',
            color: '#fbbf24',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
            textAlign: 'left',
            lineHeight: '1.4'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>
              <strong>Privacy Tip:</strong> We recommend connecting a <strong>secondary/burner GitHub account</strong> since AstroBucket commits assets directly, altering contributions Graphs.
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

        {/* Primary OAuth Action */}
        <button
          type="button"
          onClick={handleGithubOAuth}
          className="btn btn-glowing"
          style={{ 
            width: '100%', 
            justifyContent: 'center', 
            borderRadius: '12px',
            padding: '0.85rem 1.5rem',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            background: '#24292e',
            border: '1px solid rgba(255,255,255,0.08)'
          }}
          disabled={connecting}
        >
          <GithubIcon size={20} />
          Sign in with GitHub
        </button>


        {!hasClientId && (
          <div style={{
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.15)',
            borderRadius: '8px',
            padding: '0.75rem',
            fontSize: '0.75rem',
            color: '#93c5fd',
            marginBottom: '1.5rem',
            textAlign: 'left',
            lineHeight: '1.4'
          }}>
            OAuth App credentials not detected in your local <code>.env</code> file. To test, please use the local fallback option below.
          </div>
        )}

        {/* Local testing accordion toggle */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.25rem' }}>
          <button
            type="button"
            className="text-muted"
            onClick={() => setShowFallback(!showFallback)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
              padding: '0.25rem 0'
            }}
          >
            <span>Local PAT Fallback (Developer Testing)</span>
            {showFallback ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showFallback && (
            <div style={{ marginTop: '1rem', animation: 'fadeIn 0.2s ease' }}>
              <p className="text-muted" style={{ fontSize: '0.775rem', marginBottom: '1rem', lineHeight: '1.4' }}>
                Use a Personal Access Token (Classic with <code>repo</code> scope) for local development testing without setting up a registered OAuth app.
              </p>
              
              <form onSubmit={handleManualSubmit}>
                <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="input-label" style={{ fontSize: '0.775rem' }}>Personal Access Token</label>
                  <div style={{ position: 'relative' }}>
                    <Key style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
                    <input 
                      type="password" 
                      className="input-field" 
                      style={{ paddingLeft: '2.5rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }}
                      placeholder="ghp_xxxxxxxxxxxx" 
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      required
                      disabled={connecting}
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%', justifyContent: 'center', borderRadius: '8px', padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}
                  disabled={connecting || !token.trim()}
                >
                  <Save size={16} /> {connecting ? 'Verifying...' : 'Verify & Connect Local PAT'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
