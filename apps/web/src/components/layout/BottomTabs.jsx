import { NavLink } from 'react-router-dom';
import { Icon } from './Icon.jsx';

/** On phones the sidebar becomes a fixed bottom tab bar (spec 13.2). */
export function BottomTabs({ items }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {items.slice(0, 6).map((item) => (
        <NavLink key={item.to + item.label} to={item.to} end>
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
