import { Link } from 'react-router-dom';
import { APP_NAME } from '@ccp/shared';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Icon } from './Icon.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { BellButton } from '../notifications/BellButton.jsx';

/** Calendar icon and notification bell sit at the top right of every screen (FR-CAL-01, FR-NOTIF-01). */
export function TopBar() {
  const { user, logout } = useAuth();
  return (
    <div className="topbar">
      <Link className="topbar-brand" to="/">
        {APP_NAME}
      </Link>
      <span className="muted small" data-testid="whoami">
        {user?.fullName}
      </span>
      <div className="topbar-actions">
        <ThemeToggle />
        <Link className="icon-btn" to="/calendar" aria-label="Calendar" title="Calendar">
          <Icon name="calendar" />
        </Link>
        <BellButton />
        <button className="icon-btn" onClick={logout} aria-label="Log out" title="Log out">
          <Icon name="logout" />
        </button>
      </div>
    </div>
  );
}
