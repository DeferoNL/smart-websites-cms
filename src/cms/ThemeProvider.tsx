import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CMS_THEME_KEY, cmsTheme, type CmsTheme } from './theme.ts';

const ThemeContext = createContext<{ theme: CmsTheme; toggleTheme: () => void }>({ theme: 'dark', toggleTheme: () => {} });

export function CmsThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<CmsTheme>('dark');
  useEffect(() => {
    try { setTheme(cmsTheme(localStorage.getItem(CMS_THEME_KEY))); } catch { /* Storage can be unavailable. */ }
  }, []);
  useEffect(() => { document.documentElement.dataset['cmsTheme'] = theme; }, [theme]);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem(CMS_THEME_KEY, next); } catch { /* Keep the choice for this session. */ }
  };
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export const useCmsTheme = () => useContext(ThemeContext);