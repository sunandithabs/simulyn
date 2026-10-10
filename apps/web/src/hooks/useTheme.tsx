'use client';

import { createContext, useContext, useEffect, useState } from 'react';

import { applyTheme, DEFAULT_THEME_ID, resolveThemeId, THEME_STORAGE_KEY } from '@/lib/themes';

interface ThemeContextValue {
  themeId: string;
  setThemeId: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeId: DEFAULT_THEME_ID,
  setThemeId: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState(DEFAULT_THEME_ID);

  useEffect(() => {
    let stored = DEFAULT_THEME_ID;
    try {
      stored = resolveThemeId(window.localStorage.getItem(THEME_STORAGE_KEY));
      window.localStorage.setItem(THEME_STORAGE_KEY, stored);
    } catch {}
    setThemeIdState(stored);
    applyTheme(stored);
  }, []);

  function setThemeId(id: string) {
    const next = resolveThemeId(id);
    setThemeIdState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
    applyTheme(next);
  }

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
