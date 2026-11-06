import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

type Theme = 'light' | 'dark';
const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('netcom-theme', theme); } catch { /* Storage có thể bị chặn. */ }
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, toggle: () => setTheme((value) => value === 'dark' ? 'light' : 'dark') }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('Thiếu ThemeProvider.');
  const label = context.theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
  return <button type="button" className="icon-button theme-toggle" title={label} aria-label={label}
    aria-pressed={context.theme === 'dark'} onClick={context.toggle}><Icon name={context.theme === 'dark' ? 'sun' : 'moon'} size={19} /></button>;
}
