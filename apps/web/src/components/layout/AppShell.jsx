import { useEffect } from 'react';
import { Outlet, matchPath, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { rememberClub, sidebarFor } from '../../utils/navigation.js';
import { Sidebar } from './Sidebar.jsx';
import { TopBar } from './TopBar.jsx';
import { BottomTabs } from './BottomTabs.jsx';
import { ToastStack } from '../notifications/ToastStack.jsx';
import { ChatPanel } from '../chat/ChatPanel.jsx';
import { ErrorBoundary } from '../ui/ErrorBoundary.jsx';

export function AppShell() {
  const { platformRole, memberships } = useAuth();
  const { pathname } = useLocation();
  const clubId =
    matchPath('/club/:clubId/*', pathname)?.params.clubId ??
    matchPath('/club/:clubId', pathname)?.params.clubId;
  const slug = matchPath('/clubs/:slug', pathname)?.params.slug;
  const chatClub = clubId ?? slug;
  const items = sidebarFor({ platformRole, memberships, clubId });

  useEffect(() => {
    if (clubId) rememberClub(clubId);
  }, [clubId]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Sidebar items={items} label={clubId ? 'Club workspace' : 'Main'} />
      <div className="main">
        <TopBar />
        <main id="main" className="content" tabIndex={-1}>
          <ErrorBoundary resetKey={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <BottomTabs items={items} />
      <ToastStack />
      {platformRole === 'student' && <ChatPanel key={chatClub ?? 'general'} clubId={chatClub} />}
    </div>
  );
}
