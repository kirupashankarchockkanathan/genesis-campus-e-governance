import { useState } from 'react';
import { Icon } from './Icon.jsx';

const KEY = 'ccp:theme';
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? 'system';
  } catch {
    return 'system';
  }
};
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}
export const initTheme = () => applyTheme(read());

/** Cycles light -> dark -> system (FR-SET-01). */
export function ThemeToggle() {
  const [theme, setTheme] = useState(read);
  const next = { system: 'light', light: 'dark', dark: 'system' }[theme];
  const click = () => {
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      className="icon-btn"
      onClick={click}
      aria-label={`Theme: ${theme}. Switch to ${next}`}
      title={`Theme: ${theme}`}
    >
      <Icon name="moon" />
    </button>
  );
}
