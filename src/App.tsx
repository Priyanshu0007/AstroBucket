import { useState, useEffect } from 'react';
import { SettingsModal } from './components/SettingsModal';
import { FileExplorer } from './components/FileExplorer';
import type { GithubCredentials } from './lib/github';

function App() {
  const [creds, setCreds] = useState<GithubCredentials | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('astrobucket-creds');
    if (saved) {
      try {
        setCreds(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved credentials');
      }
    }
  }, []);

  const handleSaveCreds = (newCreds: GithubCredentials) => {
    localStorage.setItem('astrobucket-creds', JSON.stringify(newCreds));
    setCreds(newCreds);
  };

  const handleLogout = () => {
    localStorage.removeItem('astrobucket-creds');
    setCreds(null);
  };

  return (
    <>
      {!creds ? (
        <SettingsModal 
          initialCreds={{}} 
          onSave={handleSaveCreds} 
          isClosable={false} 
        />
      ) : (
        <FileExplorer 
          creds={creds} 
          onLogout={handleLogout} 
        />
      )}
    </>
  );
}

export default App;
