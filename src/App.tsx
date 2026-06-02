import { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { SettingsModal } from './components/SettingsModal';
import { FileExplorer } from './components/FileExplorer';
import { RefreshCw } from 'lucide-react';
import axios from 'axios';

export interface GithubSession {
  token: string;
  owner: string;
}

/**
 * App.tsx
 * 
 * Main application container managing session state, views, and OAuth redirects.
 */
function App() {
  const [session, setSession] = useState<GithubSession | null>(null);
  const [view, setView] = useState<'landing' | 'explorer'>('landing');
  const [isConnectOpen, setIsConnectOpen] = useState<boolean>(false);
  const [loadingSession, setLoadingSession] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // 1. Detect OAuth redirect callback code (?code=...) on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      // Clean up URL query parameters instantly
      window.history.replaceState({}, document.title, window.location.pathname);
      
      const exchangeCode = async () => {
        setLoadingSession(true);
        setAuthError(null);
        try {
          const response = await axios.post('/api/auth/github', { code });
          const { access_token, user } = response.data;
          
          if (access_token && user?.login) {
            const newSession = { token: access_token, owner: user.login };
            localStorage.setItem('astrobucket-session', JSON.stringify(newSession));
            setSession(newSession);
            setView('explorer');
          } else {
            throw new Error('Invalid token details returned.');
          }
        } catch (err) {
          console.error('OAuth exchange error:', err);
          let msg = 'Failed to exchange authentication code.';
          if (axios.isAxiosError(err)) {
            msg = err.response?.data?.error || err.message || msg;
          } else if (err instanceof Error) {
            msg = err.message;
          }
          setAuthError(msg);
        } finally {
          setLoadingSession(false);
        }
      };

      exchangeCode();
    }
  }, []);

  // 2. Load saved session or legacy credentials on startup
  useEffect(() => {
    const savedSession = localStorage.getItem('astrobucket-session');
    const savedCreds = localStorage.getItem('astrobucket-creds');

    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        if (parsed.token && parsed.owner) {
          setSession(parsed);
          setView('explorer'); // Auto-login returning users to console
        }
      } catch (e) {
        console.error('Failed to parse saved session', e);
      }
    } else if (savedCreds) {
      // Migrate legacy credentials
      try {
        const parsed = JSON.parse(savedCreds);
        if (parsed.token && parsed.owner) {
          const newSession: GithubSession = { token: parsed.token, owner: parsed.owner };
          localStorage.setItem('astrobucket-session', JSON.stringify(newSession));
          
          // Save the repository as the first attached repo for user
          if (parsed.repo) {
            const repoData = { repo: parsed.repo, branch: parsed.branch || 'main' };
            localStorage.setItem(`astrobucket-attached-repos-${parsed.owner}`, JSON.stringify([repoData]));
            localStorage.setItem(`astrobucket-active-repo-${parsed.owner}`, JSON.stringify(repoData));
          }
          
          localStorage.removeItem('astrobucket-creds');
          setSession(newSession);
          setView('explorer');
          console.log('Migrated legacy credentials to new format.');
        }
      } catch (e) {
        console.error('Failed to migrate credentials', e);
      }
    }
  }, []);

  const handleSaveSession = (token: string, owner: string) => {
    const newSession = { token, owner };
    localStorage.setItem('astrobucket-session', JSON.stringify(newSession));
    setSession(newSession);
    setIsConnectOpen(false);
    setView('explorer'); // Transition to dashboard
  };

  const handleLogout = () => {
    localStorage.removeItem('astrobucket-session');
    setSession(null);
    setView('landing'); // Return to landing page
  };

  return (
    <>
      {/* Full-screen loading spinner while exchanging OAuth code */}
      {loadingSession && (
        <div className="modal-overlay" style={{ background: '#080a0f', zIndex: 9999 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <RefreshCw size={40} className="spin text-gradient" style={{ color: '#3b82f6' }} />
            <p className="text-muted" style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}>
              Exchanging authorization code...
            </p>
          </div>
        </div>
      )}

      {/* Auth Error Banner overlay */}
      {authError && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content glass-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h3 style={{ color: '#f87171', marginBottom: '0.75rem', fontWeight: 600 }}>Connection Failed</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              {authError}
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setAuthError(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Conditional routing views */}
      {view === 'landing' ? (
        <LandingPage 
          onConnect={() => setIsConnectOpen(true)} 
          hasCreds={!!session}
          onLaunchConsole={() => setView('explorer')}
        />
      ) : (
        session && (
          <FileExplorer 
            session={session} 
            onLogout={handleLogout} 
          />
        )
      )}

      {/* Connection form Modal rendering as overlay */}
      {isConnectOpen && (
        <SettingsModal 
          initialToken={session?.token || ''}
          initialOwner={session?.owner || ''}
          onSave={handleSaveSession} 
          isClosable={true} 
          onClose={() => setIsConnectOpen(false)}
        />
      )}
    </>
  );
}

export default App;
