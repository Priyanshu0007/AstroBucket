import { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { SettingsModal } from './components/SettingsModal';
import { FileExplorer } from './components/FileExplorer';
import type { GithubCredentials } from './lib/github';

/**
 * App.tsx
 * 
 * Main application container managing state and transitions.
 * Views:
 * - 'landing': The premium animated product landing page.
 * - 'explorer': The S3-style repository file browser dashboard.
 * 
 * Connection Modal:
 * - Rendered as a glassmorphic overlay on top of the current screen.
 */
function App() {
  const [creds, setCreds] = useState<GithubCredentials | null>(null);
  const [view, setView] = useState<'landing' | 'explorer'>('landing');
  const [isConnectOpen, setIsConnectOpen] = useState<boolean>(false);

  // Load saved credentials on startup
  useEffect(() => {
    const saved = localStorage.getItem('astrobucket-creds');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCreds(parsed);
        setView('explorer'); // Auto-login returning users to console
      } catch (e) {
        console.error('Failed to parse saved credentials', e);
      }
    }
  }, []);

  const handleSaveCreds = (newCreds: GithubCredentials) => {
    localStorage.setItem('astrobucket-creds', JSON.stringify(newCreds));
    setCreds(newCreds);
    setIsConnectOpen(false);
    setView('explorer'); // Transition to explorer console
  };

  const handleLogout = () => {
    localStorage.removeItem('astrobucket-creds');
    setCreds(null);
    setView('landing'); // Return to landing page
  };

  return (
    <>
      {/* Conditional routing views */}
      {view === 'landing' ? (
        <LandingPage 
          onConnect={() => setIsConnectOpen(true)} 
          hasCreds={!!creds}
          onLaunchConsole={() => setView('explorer')}
        />
      ) : (
        creds && (
          <FileExplorer 
            creds={creds} 
            onLogout={handleLogout} 
          />
        )
      )}

      {/* Connection form Modal rendering as overlay */}
      {isConnectOpen && (
        <SettingsModal 
          initialCreds={creds || {}} 
          onSave={handleSaveCreds} 
          isClosable={true} 
          onClose={() => setIsConnectOpen(false)}
        />
      )}
    </>
  );
}

export default App;
