import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './styles/utilities.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/features.css';
import './styles/showcase.css';
import { Providers } from './app/providers.jsx';
import { AppRoutes } from './app/router.jsx';
import { initTheme } from './components/layout/ThemeToggle.jsx';

initTheme();

// PWA: installable and offline app shell (Phase 3). Only in production builds.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Providers>
      <AppRoutes />
    </Providers>
  </StrictMode>,
);
