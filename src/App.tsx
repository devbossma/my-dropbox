import { useState } from 'react';
import { Authenticator, ThemeProvider, type Theme } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faParachuteBox } from '@fortawesome/free-solid-svg-icons';
import { deleteUser } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';

import './App.css';

// Components
import FileManager from './components/FileManager/FileManager';
import { ToastProvider } from './components/Toast/Toast';

const client = generateClient<Schema>();

// Custom Authenticator components
const components = {
  Header() {
    return (
      <div style={{
        textAlign: 'center',
        padding: '.5rem 0 .5rem',
      }}>
        <FontAwesomeIcon
          icon={faParachuteBox}
          size="3x"
          bounce
          style={{ color: '#3b82f6ff', marginBottom: '0.75rem' }}
        />
        <h1 style={{
          margin: 0,
          fontSize: '1.75rem',
          background: 'linear-gradient(to right, #3b82f6, #a855f7)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: 700,
        }}>
          MyDropBox
        </h1>
        <p style={{
          margin: '0.5rem 0 0',
          color: '#94a3b8',
          fontSize: '0.9rem',
        }}>
          Your files, Anywhere!
        </p>
      </div>
    );
  },
};

const theme: Theme = {
  name: 'my-dropbox-theme',
  tokens: {
    colors: {
      background: {
        primary: { value: '#0f172a' },
        secondary: { value: '#1e293b' },
      },
      font: {
        primary: { value: '#f1f5f9' },
        secondary: { value: '#94a3b8' },
        interactive: { value: '#3b82f6' },
      },
      brand: {
        primary: {
          10: { value: 'rgba(59, 130, 246, 0.1)' },
          20: { value: 'rgba(59, 130, 246, 0.2)' },
          40: { value: 'rgba(59, 130, 246, 0.4)' },
          60: { value: 'rgba(59, 130, 246, 0.6)' },
          80: { value: '#3b82f6' },
          90: { value: '#2563eb' },
          100: { value: '#1d4ed8' },
        },
      },
      border: {
        primary: { value: '#334155' },
        secondary: { value: '#334155' },
        focus: { value: '#3b82f6' },
      },
    },
    radii: {
      small: { value: '8px' },
      medium: { value: '12px' },
      large: { value: '16px' },
    },
  },
};

function App() {
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteMe = async () => {
    const confirmed = window.confirm(
      "Are you sure? This will permanently delete your account and ALL your files and folders. This action cannot be undone."
    );

    if (!confirmed) return;

    try {
      setIsDeleting(true);

      // 1. Clean up Files
      console.log("Fetching files for cleanup...");
      const { data: files } = await client.models.FileMetadata.list();
      for (const file of files) {
        console.log(`Deleting file record: ${file.fileName}`);
        await client.models.FileMetadata.delete({ id: file.id });
      }

      // 2. Clean up Folders
      console.log("Fetching folders for cleanup...");
      const { data: folders } = await client.models.Folder.list();
      for (const folder of folders) {
        if (folder.parentFolderId === 'root' && folder.name === 'root') continue; // Skip root marker if it exists
        console.log(`Deleting folder record: ${folder.name}`);
        await client.models.Folder.delete({ id: folder.id });
      }

      // 3. Delete the account
      console.log("Deleting user account...");
      await deleteUser();

      // The page will likely reload or redirect upon account deletion success
    } catch (error) {
      console.error('Error during cleanup and account deletion:', error);
      alert("An error occurred while deleting your account. Please try again.");
      setIsDeleting(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <ToastProvider>
        <Authenticator components={components}>
          {({ signOut, user }) => (
            <main className="app-container">
              <header className="app-header">
                <div className="logo">
                  <span className="logo-icon"></span>
                  <h1><FontAwesomeIcon icon={faParachuteBox} bounce size="xl" style={{ color: "#3b82fc", }} />MyDropBox</h1>
                </div>
                <div className="user-controls">
                  <span className="username">{user?.username}</span>
                  <button onClick={signOut} className="sign-out-btn">Sign out</button>
                  <button onClick={deleteMe} className="delete-btn" disabled={isDeleting}>Delete Account</button>
                </div>
              </header>

              {isDeleting && (
                <div className="deleting-overlay">
                  <div className="deleting-content">
                    <div className="spinner"></div>
                    <h2>Deleting Account</h2>
                    <p>Please wait while we permanently remove your data and close your account...</p>
                  </div>
                </div>
              )}

              <div className="content-area">
                <FileManager />
              </div>
            </main>
          )}
        </Authenticator>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;