import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { GovProvider } from './context/GovContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <GovProvider>
          <AppProvider>
            <App />
          </AppProvider>
        </GovProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
