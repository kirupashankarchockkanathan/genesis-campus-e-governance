import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './styles/utilities.css';
import './styles/components.css';
import './styles/layout.css';
import { Providers } from './app/providers.jsx';
import { AppRoutes } from './app/router.jsx';
import { initTheme } from './components/layout/ThemeToggle.jsx';

initTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Providers>
      <AppRoutes />
    </Providers>
  </StrictMode>,
);
