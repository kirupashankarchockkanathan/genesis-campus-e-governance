import { NavLink, Link } from 'react-router-dom';
import { APP_NAME } from '@ccp/shared';
import { Icon } from './Icon.jsx';

export function Sidebar({ items, label }) {
  return (
    <aside className="sidebar">
      <Link className="brand" to="/">
        <span className="brand-mark" aria-hidden="true">
          C
        </span>
        <span>{APP_NAME}</span>
      </Link>
      <nav className="nav" aria-label={label}>
        {items.map((item) => (
          <NavLink key={item.to + item.label} to={item.to} end className="nav-link">
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
