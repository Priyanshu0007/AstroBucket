import { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { SettingsModal } from './components/SettingsModal';
import { FileExplorer } from './components/FileExplorer';
import { PinModal } from './components/PinModal';
import { encryptToken, decryptToken } from './lib/crypto';
import { setDecryptedToken } from './api/client';
import { RefreshCw } from 'lucide-react';
import axios from 'axios';

export interface GithubSession {
  token: string;
  owner: string;
}

/**
 * App.tsx
 * 
 * Main application container managing session state, views, OAuth redirects, and PIN security.
 */
function App() {
  const [session, setSession] = useState<GithubSession | null>(null);
  const [pendingSession, setPendingSession] = useState<GithubSession | null>(null);
  const [view, setView] = useState<'landing' | 'explorer'>('landing');
  const [isConnectOpen, setIsConnectOpen] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<'create' | 'unlock' | null>(null);
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
            setPendingSession({ token: access_token, owner: user.login });
            setShowPinModal('create');
          } else {
            throw new Error('Invalid token details returned.');
          }
        } catch (err: any) {
          console.error('OAuth exchange error:', err);
          const msg = err.response?.data?.error || err.message || 'Failed to exchange authentication code.';
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
        if (parsed.token) {
          // If token contains 'ciphertext', it is properly encrypted
          if (parsed.token.includes('ciphertext')) {
            setPendingSession(parsed);
            setShowPinModal('unlock');
          } else {
            // Auto-upgrade unencrypted legacy sessions to secure format
            setPendingSession(parsed);
            setShowPinModal('create');
          }
        }
      } catch (e) {
        console.error('Failed to parse saved session', e);
      }
    } else if (savedCreds) {
      // Migrate legacy credentials and secure them
      try {
        const parsed = JSON.parse(savedCreds);
        if (parsed.token && parsed.owner) {
          const newSession: GithubSession = { token: parsed.token, owner: parsed.owner };
          
          // Save the repository as the first attached repo for user
          if (parsed.repo) {
            const repoData = { repo: parsed.repo, branch: parsed.branch || 'main' };
            localStorage.setItem(`astrobucket-attached-repos-${parsed.owner}`, JSON.stringify([repoData]));
            localStorage.setItem(`astrobucket-active-repo-${parsed.owner}`, JSON.stringify(repoData));
          }
          
          localStorage.removeItem('astrobucket-creds');
          setPendingSession(newSession);
          setShowPinModal('create'); // Ask to secure it with a PIN
          console.log('Migrated legacy credentials. Requesting encryption setup.');
        }
      } catch (e) {
        console.error('Failed to migrate credentials', e);
      }
    }
  }, []);

  // Triggered when PIN modal operations succeed (create or unlock)
  const handlePinComplete = async (pin: string) => {
    if (!pendingSession) return;

    if (showPinModal === 'create') {
      // Encrypt the plain-text token
      const encryptedToken = await encryptToken(pendingSession.token, pin);
      const secureSession = { token: encryptedToken, owner: pendingSession.owner };
      
      // Store ciphertext session in localStorage
      localStorage.setItem('astrobucket-session', JSON.stringify(secureSession));
      
      // Keep plain-text session in React state and Client header in-memory
      setDecryptedToken(pendingSession.token);
      setSession({ token: pendingSession.token, owner: pendingSession.owner });
      
      setPendingSession(null);
      setShowPinModal(null);
      setView('explorer');
    } else if (showPinModal === 'unlock') {
      // Decrypt the ciphertext token from storage
      const decryptedTokenVal = await decryptToken(pendingSession.token, pin);
      
      // Keep plain-text session in React state and Client header in-memory
      setDecryptedToken(decryptedTokenVal);
      setSession({ token: decryptedTokenVal, owner: pendingSession.owner });
      
      setPendingSession(null);
      setShowPinModal(null);
      setView('explorer');
    }
  };

  const handleSaveSession = (token: string, owner: string) => {
    // Initiate PIN setup to encrypt the manual fallback credentials before saving
    setPendingSession({ token, owner });
    setIsConnectOpen(false);
    setShowPinModal('create');
  };

  const handleLogout = () => {
    localStorage.removeItem('astrobucket-session');
    setDecryptedToken(null);
    setSession(null);
    setPendingSession(null);
    setView('landing'); // Return to landing page
  };

  const handleResetSession = () => {
    // Wipe local storage and state when user requests a hard reset (forgot PIN)
    localStorage.removeItem('astrobucket-session');
    setDecryptedToken(null);
    setSession(null);
    setPendingSession(null);
    setShowPinModal(null);
    setView('landing');
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

      {/* Security PIN creation/entry dialog */}
      {showPinModal && (
        <PinModal
          mode={showPinModal}
          onComplete={handlePinComplete}
          onResetSession={handleResetSession}
        />
      )}
    </>
  );
}

export default App;
