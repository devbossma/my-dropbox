import { Authenticator, ThemeProvider, type Theme } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faParachuteBox } from '@fortawesome/free-solid-svg-icons';

import './App.css';

// Components
import FileManager from './components/FileManager/FileManager';
import { ToastProvider } from './components/Toast/Toast';

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
                </div>
              </header>

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