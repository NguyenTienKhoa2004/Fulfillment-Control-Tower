import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

type Theme = 'light' | 'dark';
const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('netcom-theme', theme); } catch { /* Storage may be blocked. */ }
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, toggle: () => setTheme((value) => value === 'dark' ? 'light' : 'dark') }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('ThemeProvider is missing.');
  const label = context.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
  return <button type="button" className="icon-button theme-toggle" title={label} aria-label={label}
    aria-pressed={context.theme === 'dark'} onClick={context.toggle}><Icon name={context.theme === 'dark' ? 'sun' : 'moon'} size={19} /></button>;
}
