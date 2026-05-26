import { useState, useEffect } from 'react';
import { SettingsModal } from './components/SettingsModal';
import { FileExplorer } from './components/FileExplorer';
import { GithubCredentials } from './lib/github';

function App() {
  const [creds, setCreds] = useState<GithubCredentials | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('github-s3-creds');
    if (saved) {
      try {
        setCreds(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved credentials');
      }
    }
  }, []);

  const handleSaveCreds = (newCreds: GithubCredentials) => {
    localStorage.setItem('github-s3-creds', JSON.stringify(newCreds));
    setCreds(newCreds);
  };

  const handleLogout = () => {
    localStorage.removeItem('github-s3-creds');
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
