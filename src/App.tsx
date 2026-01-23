import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

import './App.css';

// Components
import FileManager from './components/FileManager/FileManager';



function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <main className="app-container">
          <header className="app-header">
            <div className="logo">
              <span className="logo-icon"></span>
              <h1>CloudBox</h1>
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
  );
}

export default App;