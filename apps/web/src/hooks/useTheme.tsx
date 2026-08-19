'use client';

import { createContext, useContext, useEffect, useState } from 'react';

import { applyTheme, DEFAULT_THEME_ID, THEME_STORAGE_KEY } from '@/lib/themes';

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
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_THEME_ID;
    setThemeIdState(stored);
    applyTheme(stored);
  }, []);

  function setThemeId(id: string) {
    setThemeIdState(id);
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
    applyTheme(id);
  }

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
