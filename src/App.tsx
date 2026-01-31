import { useState, useEffect, useCallback } from 'react';
import { Authenticator, ThemeProvider, type Theme } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { deleteUser } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import { remove } from 'aws-amplify/storage';
import { Routes, Route } from 'react-router-dom';
import type { Schema } from '../amplify/data/resource';

import './App.css';

// Components
import FileManager from './components/FileManager/FileManager';
import { ToastProvider } from './components/Toast/Toast';
import LoginBackground from './components/Login/LoginBackground';
import Sidebar from './components/Sidebar/Sidebar';
import Header from './components/Header/Header';
import Profile from './components/Profile/Profile';
import SharedFilePage from './components/Share/SharedFilePage';
import logoSvg from './assets/logo.svg';

// Utils
import {
  formatBytes,
  getStorageLimitBytes,
  getStoragePercentage,
  getStorageStatus,
  type StoragePlan,
  type StorageStatus
} from './utils/storageUtils';

const client = generateClient<Schema>();

// Custom Authenticator components
const components = {
  Header() {
    return (
      <div className="auth-header">
        <div className="parachute-container">
          <img src={logoSvg} alt="MyDropBox Logo" className="parachute-logo-img" />
        </div>
        <h1 className="auth-title">MyDropBox</h1>
        <p className="auth-subtitle">Your files, Anywhere!</p>
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

function AuthenticatedApp() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentView, setCurrentView] = useState<'files' | 'profile'>('files');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Storage state
  const [storageUsedBytes, setStorageUsedBytes] = useState(0);
  const [userPlan, setUserPlan] = useState<StoragePlan>('FREE');

  const storageLimitBytes = getStorageLimitBytes(userPlan);
  const storagePercentage = getStoragePercentage(storageUsedBytes, storageLimitBytes);
  const storageStatus: StorageStatus = getStorageStatus(storagePercentage);

  // Fetch storage usage from UserProfile
  const refreshStorageUsage = useCallback(async () => {
    try {
      // 1. Get Profile
      const { data: profiles } = await client.models.UserProfile.list();

      if (profiles && profiles.length > 0) {
        const profile = profiles[0];
        setStorageUsedBytes(profile.storageUsed || 0);
        setUserPlan((profile.plan as StoragePlan) || 'FREE');

        // 2. Background Sync (Self-healing)
        // We run this quietly to ensure data consistency
        import('./utils/storageSync').then(({ syncStorageUsage }) => {
          syncStorageUsage().then(realSize => {
            if (realSize !== profile.storageUsed) {
              console.log('Storage synced. Updating UI.');
              setStorageUsedBytes(realSize);
            }
          }).catch(e => console.error("Storage sync failed", e));
        });
      }
    } catch (error) {
      console.error('Failed to fetch storage usage:', error);
    }
  }, []);

  // Fetch storage on mount
  useEffect(() => {
    refreshStorageUsage();
  }, [refreshStorageUsage]);

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

      // 3. Clean up User Profile and Avatar
      const { data: profiles } = await client.models.UserProfile.list();
      if (profiles.length > 0) {
        const profile = profiles[0];

        if (profile.avatarUrl) {
          try {
            console.log(`Removing avatar from storage: ${profile.avatarUrl}`);
            await remove({ path: profile.avatarUrl });
          } catch (storageErr) {
            console.warn("Failed to remove avatar image", storageErr);
          }
        }

        console.log("Deleting UserProfile...");
        await client.models.UserProfile.delete({ id: profile.id });
      }

      // 4. Delete the account
      console.log("Deleting user account...");
      await deleteUser();

    } catch (error) {
      console.error('Error during cleanup and account deletion:', error);
      alert("An error occurred while deleting your account. Please try again.");
      setIsDeleting(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <LoginBackground />
      <ToastProvider>
        <Authenticator components={components}>
          {({ signOut, user }) => (
            <div className="app-shell">
              <Sidebar
                storageUsed={formatBytes(storageUsedBytes)}
                storageTotal={formatBytes(storageLimitBytes)}
                storagePercentage={storagePercentage}
                storageStatus={storageStatus}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                currentView={currentView}
                onViewChange={setCurrentView}
              />

              <main className="app-main">
                <Header
                  user={user}
                  signOut={signOut || (() => { })}
                  onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                  onViewChange={setCurrentView}
                />

                <div className="app-content">
                  {isDeleting && (
                    <div className="deleting-overlay">
                      <div className="deleting-content">
                        <div className="spinner"></div>
                        <h2>Deleting Account</h2>
                        <p>Total cleanup in progress...</p>
                      </div>
                    </div>
                  )}

                  {currentView === 'files' ? (
                    // storageUsed, storageLimit, onStorageChange
                    <FileManager storageUsed={storageUsedBytes} storageLimit={storageLimitBytes} onStorageChange={refreshStorageUsage} />
                  ) : (
                    <Profile
                      user={user}
                      onDeleteAccount={deleteMe}
                      isDeleting={isDeleting}
                    />
                  )}
                </div>
              </main>
            </div>
          )}
        </Authenticator>
      </ToastProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/s/:linkId" element={<SharedFilePage />} />
      <Route path="*" element={<AuthenticatedApp />} />
    </Routes>
  );
}

export default App;