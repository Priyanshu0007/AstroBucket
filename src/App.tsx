import { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { SettingsModal } from './components/SettingsModal';
import { FileExplorer } from './components/FileExplorer';

export interface GithubSession {
  token: string;
  owner: string;
}

/**
 * App.tsx
 * 
 * Main application container managing session state and views.
 * Views:
 * - 'landing': The premium animated product landing page.
 * - 'explorer': The S3-style dashboard and repository explorer.
 */
function App() {
  const [session, setSession] = useState<GithubSession | null>(null);
  const [view, setView] = useState<'landing' | 'explorer'>('landing');
  const [isConnectOpen, setIsConnectOpen] = useState<boolean>(false);

  // Load saved credentials or session on startup
  useEffect(() => {
    const savedSession = localStorage.getItem('astrobucket-session');
    const savedCreds = localStorage.getItem('astrobucket-creds');

    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession));
        setView('explorer'); // Auto-login returning users to console
      } catch (e) {
        console.error('Failed to parse saved session', e);
      }
    } else if (savedCreds) {
      // Migrate legacy credentials to session format
      try {
        const parsed = JSON.parse(savedCreds);
        if (parsed.token && parsed.owner) {
          const newSession: GithubSession = { token: parsed.token, owner: parsed.owner };
          localStorage.setItem('astrobucket-session', JSON.stringify(newSession));
          
          // Save the repository as the first attached repo
          if (parsed.repo) {
            const repoData = { repo: parsed.repo, branch: parsed.branch || 'main' };
            localStorage.setItem(`astrobucket-attached-repos-${parsed.owner}`, JSON.stringify([repoData]));
            localStorage.setItem(`astrobucket-active-repo-${parsed.owner}`, JSON.stringify(repoData));
          }
          
          localStorage.removeItem('astrobucket-creds');
          setSession(newSession);
          setView('explorer');
          console.log('Migrated legacy credentials to new session format.');
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
